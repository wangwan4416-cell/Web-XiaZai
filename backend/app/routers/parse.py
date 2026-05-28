import json
import re
import httpx
from urllib.parse import urlparse, quote
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["parse"])

TIMEOUT_SECONDS = 15

PLATFORM_PATTERNS = {
    "douyin": r"douyin\.com|iesdouyin\.com",
    "kuaishou": r"kuaishou\.com|gifshow\.com",
    "bilibili": r"bilibili\.com|b23\.tv|b22\.tv",
}


class ParseRequest(BaseModel):
    url: str


URL_RE = re.compile(r"https?://[^\s]+", re.IGNORECASE)


def extract_url(text: str) -> str:
    """从分享文本中提取纯 URL。支持抖音/B站/快手等平台的分享文案。"""
    matches = URL_RE.findall(text)
    if matches:
        return matches[0].rstrip(".,;:!?）)】》")
    return text


def detect_platform(url: str) -> str | None:
    for platform, pattern in PLATFORM_PATTERNS.items():
        if re.search(pattern, url, re.IGNORECASE):
            return platform
    return None


# ═══════════════════════════════════════════════════════════
# Bilibili 解析 — 使用官方 API
# ═══════════════════════════════════════════════════════════

BILIBILI_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.bilibili.com/",
}


def extract_bvid(url: str) -> str | None:
    """从 B 站 URL 提取 BV 号。"""
    # 标准格式: bilibili.com/video/BVxxx 或 b23.tv/BVxxx
    match = re.search(r"(BV[a-zA-Z0-9]{10})", url)
    if match:
        return match.group(1)
    # AV 号格式
    match = re.search(r"/av(\d+)", url, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


async def resolve_b23(url: str) -> str:
    """解析 B 站短链接 (b23.tv)，跟随重定向获取完整 URL。"""
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS, follow_redirects=False) as client:
        resp = await client.get(url, headers=BILIBILI_HEADERS)
        location = resp.headers.get("location", "")
        if location:
            if not location.startswith("http"):
                base = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
                location = base + location
            return location
    return url


async def parse_bilibili(url: str) -> dict:
    """使用 B 站官方 API 解析视频信息。"""
    # 处理短链接
    if "b23.tv" in url or "b22.tv" in url:
        url = await resolve_b23(url)

    bvid = extract_bvid(url)
    if not bvid:
        return {"code": 400, "msg": "无法从链接中提取 B 站视频 ID"}

    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        # 获取视频基本信息
        resp = await client.get(
            "https://api.bilibili.com/x/web-interface/view",
            params={"bvid": bvid},
            headers=BILIBILI_HEADERS,
        )
        data = resp.json()

        if data.get("code") != 0:
            msg = data.get("message", "B站接口返回错误")
            return {"code": 502, "msg": msg}

        info = data["data"]
        cid = info.get("cid", 0)

        # 获取无水印下载地址
        video_url = ""
        if cid:
            play_resp = await client.get(
                "https://api.bilibili.com/x/player/playurl",
                params={"bvid": bvid, "cid": cid, "qn": 80, "fnval": 1, "fourk": 1},
                headers=BILIBILI_HEADERS,
            )
            play_data = play_resp.json()
            if play_data.get("code") == 0:
                durl = play_data["data"].get("durl")
                if durl and len(durl) > 0:
                    video_url = durl[0].get("url", "")

        return {
            "code": 200,
            "data": {
                "platform": "bilibili",
                "title": info.get("title", ""),
                "author": info.get("owner", {}).get("name", ""),
                "cover": str(info.get("pic", "")).replace("http://", "https://"),
                "video_url": video_url,
            },
        }


# ═══════════════════════════════════════════════════════════
# Douyin / Kuaishou 解析 — 直接解析，不依赖外部API
# ═══════════════════════════════════════════════════════════

DOUYIN_MOBILE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/16.6 Mobile/15E148 Safari/604.1"
    ),
    "Referer": "https://www.douyin.com/",
}

DOUYIN_VIDEO_ID_RE = re.compile(r"/video/(\d{19})")
ROUTER_DATA_RE = re.compile(r"window\._ROUTER_DATA\s*=\s*(.*?)</script>", re.DOTALL)
RENDER_DATA_RE = re.compile(r'<script[^>]*id="RENDER_DATA"[^>]*>(.*?)</script>', re.DOTALL)


async def _resolve_douyin_short(url: str) -> str | None:
    """跟随 v.douyin.com 短链接重定向，获取真实 URL。"""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
            resp = await client.get(url, headers=DOUYIN_MOBILE_HEADERS)
            location = resp.headers.get("location", "")
            if location:
                return location
    except Exception:
        pass
    return None


async def _fetch_share_page(video_id: str) -> str | None:
    """获取抖音分享页 HTML（使用移动端 UA）。"""
    share_url = f"https://www.iesdouyin.com/share/video/{video_id}/"
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(share_url, headers=DOUYIN_MOBILE_HEADERS)
            if resp.status_code == 200:
                return resp.text
    except Exception:
        pass
    return None


def _extract_video_from_html(html: str) -> dict | None:
    """从 HTML 中提取视频数据。先尝试 _ROUTER_DATA，再尝试 RENDER_DATA。"""
    # 方式1: window._ROUTER_DATA
    match = ROUTER_DATA_RE.search(html)
    if match:
        try:
            router = json.loads(match.group(1))
            loader = router.get("loaderData", {})
            for _key, value in loader.items():
                if isinstance(value, dict) and "videoInfoRes" in value:
                    items = value["videoInfoRes"].get("item_list", [])
                    if items:
                        return items[0]
        except (json.JSONDecodeError, KeyError):
            pass
    # 方式2: <script id="RENDER_DATA">
    match = RENDER_DATA_RE.search(html)
    if match:
        try:
            from urllib.parse import unquote
            decoded = unquote(match.group(1))
            render = json.loads(decoded)
            # RENDER_DATA 结构可能不同，尝试多种路径
            for path in [
                ["app", "videoInfoRes", "item_list"],
                ["data", "videoInfoRes", "item_list"],
            ]:
                try:
                    node = render
                    for key in path:
                        node = node[key]
                    if isinstance(node, list) and node:
                        return node[0]
                except (KeyError, IndexError, TypeError):
                    continue
        except (json.JSONDecodeError, ValueError):
            pass
    return None


def _build_douyin_result(item: dict) -> dict:
    title = item.get("desc", "")
    author = item.get("author", {}).get("nickname", "")
    cover_list = item.get("video", {}).get("cover", {}).get("url_list", [])
    cover = cover_list[0] if cover_list else ""
    play_list = item.get("video", {}).get("play_addr", {}).get("url_list", [])
    video_url = play_list[0] if play_list else ""
    # 去水印: playwm → play
    video_url = video_url.replace("playwm", "play")

    return {
        "code": 200,
        "data": {
            "platform": "douyin",
            "title": title,
            "author": author,
            "cover": cover.replace("http://", "https://"),
            "video_url": video_url,
        },
    }


async def parse_douyin_direct(url: str) -> dict:
    """自包含抖音解析 — 不依赖任何外部 API 或 Cookie。"""
    try:
        # Step 1: 短链接重定向
        if "v.douyin.com" in url:
            real_url = await _resolve_douyin_short(url)
            if not real_url:
                return {"code": 502, "msg": "短链接重定向失败，请检查链接是否有效"}
            url = real_url

        # Step 2: 提取 19 位视频 ID
        match = DOUYIN_VIDEO_ID_RE.search(url)
        if not match:
            return {"code": 400, "msg": "无法从链接中提取抖音视频ID"}
        video_id = match.group(1)

        # Step 3: 获取分享页 HTML
        html = await _fetch_share_page(video_id)
        if not html:
            return {"code": 502, "msg": "获取视频页面失败，请稍后重试"}

        # Step 4: 提取内嵌 JSON 数据
        item = _extract_video_from_html(html)
        if not item:
            return {"code": 502, "msg": "视频数据为空，可能为私密或已删除，或页面结构已更新"}

        return _build_douyin_result(item)

    except httpx.TimeoutException:
        return {"code": 504, "msg": "抖音解析请求超时，请稍后重试"}
    except Exception as e:
        return {"code": 502, "msg": f"解析服务异常: {str(e)}"}


async def parse_douyin_or_kuaishou(url: str, platform: str) -> dict:
    if platform == "douyin":
        return await parse_douyin_direct(url)

    return {
        "code": 502,
        "msg": "快手解析暂不支持，请等待后续更新",
    }


# ═══════════════════════════════════════════════════════════
# 路由入口
# ═══════════════════════════════════════════════════════════

def _headers_for(url: str) -> dict:
    """根据域名返回合适的请求头绕过防盗链。"""
    if "douyin" in url or "iesdouyin" in url or "douyinvod" in url or "snssdk" in url or "aweme" in url:
        return {
            "User-Agent": BILIBILI_HEADERS["User-Agent"],
            "Referer": "https://www.douyin.com/",
            "Accept": "*/*",
            "Accept-Encoding": "identity",
        }
    return {
        **BILIBILI_HEADERS,
        "Accept": "*/*",
        "Accept-Encoding": "identity",
    }


@router.get("/download")
async def download_video(url: str = Query(..., description="视频文件直链")):
    """代理下载视频，添加平台必需的 Referer 头，绕过防盗链。"""
    headers = _headers_for(url)
    async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            return Response(
                content=f"下载失败 ({resp.status_code})",
                status_code=resp.status_code,
                media_type="text/plain",
            )
        filename = _extract_filename(url, resp)
        return StreamingResponse(
            resp.aiter_bytes(chunk_size=1024 * 1024),
            status_code=200,
            media_type=resp.headers.get("content-type", "video/mp4"),
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
                "Content-Length": resp.headers.get("content-length", ""),
            },
        )


def _extract_filename(url: str, _resp) -> str:
    from pathlib import Path
    path = Path(urlparse(url).path)
    name = path.name or "video"
    if "." not in name:
        content_type = _resp.headers.get("content-type", "")
        ext = content_type.split("/")[-1].split(";")[0] if "/" in content_type else "mp4"
        name = f"{name}.{ext}"
    return name


@router.post("/parse")
async def parse_video(req: ParseRequest):
    raw = req.url.strip()
    if not raw:
        return {"code": 400, "msg": "请提供视频链接"}

    url = extract_url(raw)

    platform = detect_platform(url)
    if not platform:
        return {"code": 400, "msg": "暂不支持该平台，目前支持抖音、快手、B站"}

    if platform == "bilibili":
        return await parse_bilibili(url)
    else:
        return await parse_douyin_or_kuaishou(url, platform)
