import os
import uuid
import asyncio
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import httpx

from app.config import TEMP_DIR, TASK_TIMEOUT_SECONDS
from app.services.asr import extract_audio, transcribe_audio
from app.utils.cleaner import cleanup
from app.utils.retry import retry

router = APIRouter(prefix="/api", tags=["transcribe"])

tasks: dict[str, dict] = {}


class TranscribeRequest(BaseModel):
    video_url: str


@router.post("/transcribe")
async def start_transcribe(req: TranscribeRequest):
    task_id = str(uuid.uuid4())
    tasks[task_id] = {"status": "pending", "stage": None, "text": None, "error": None}
    asyncio.create_task(_process(task_id, req.video_url))
    return {"code": 202, "task_id": task_id, "status": "pending"}


@router.get("/transcribe/{task_id}")
async def get_transcribe(task_id: str):
    task = tasks.get(task_id)
    if not task:
        return JSONResponse(status_code=404, content={"code": 404, "msg": "任务不存在"})
    if task["status"] == "failed":
        return {"code": 200, "status": "failed", "msg": task.get("error", "文案提取失败，请重试")}
    if task["status"] == "done":
        return {"code": 200, "status": "done", "data": {"text": task["text"]}}
    return {
        "code": 200,
        "status": task["status"],
        "stage": task.get("stage"),
        "progress": task.get("stage", ""),
    }


async def _process(task_id: str, video_url: str):
    video_path = os.path.join(TEMP_DIR, f"{task_id}.mp4")
    audio_path = os.path.join(TEMP_DIR, f"{task_id}.mp3")
    try:
        task = tasks[task_id]
        task["status"] = "processing"

        os.makedirs(TEMP_DIR, exist_ok=True)

        # Stage 1: Download video
        task["stage"] = "extracting_audio"
        await _download_video(video_url, video_path)

        # Stage 2: Extract audio via FFmpeg
        await extract_audio(video_path, audio_path)

        # Stage 3: Transcribe via Doubao ASR (with retry)
        task["stage"] = "transcribing"
        text = await retry(
            lambda: transcribe_audio(audio_path),
            max_retries=2,
            delays=(2, 5),
        )

        task["status"] = "done"
        task["text"] = text
    except Exception as e:
        import traceback, logging
        logging.getLogger("transcribe").error(f"Task {task_id} failed: {repr(e)}")
        traceback.print_exc()
        task = tasks.get(task_id)
        if task:
            task["status"] = "failed"
            task["error"] = repr(e)
        else:
            logging.getLogger("transcribe").error(f"Task {task_id} not found in tasks dict!")
    finally:
        cleanup(video_path, audio_path)
        # 5 分钟后清理任务记录，避免内存泄漏
        asyncio.create_task(_remove_task_after(task_id, 300))


async def _remove_task_after(task_id: str, delay: int) -> None:
    await asyncio.sleep(delay)
    tasks.pop(task_id, None)


MAX_VIDEO_BYTES = 500 * 1024 * 1024  # 500MB 上限


BASE_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)


def _headers_for(url: str) -> dict:
    """根据域名返回合适的请求头绕过防盗链。"""
    headers = {"User-Agent": BASE_UA, "Accept": "*/*", "Accept-Encoding": "identity"}
    if "douyin" in url or "iesdouyin" in url or "douyinvod" in url or "snssdk" in url or "aweme" in url:
        headers["Referer"] = "https://www.douyin.com/"
    elif "bilibili" in url or "b23.tv" in url:
        headers["Referer"] = "https://www.bilibili.com/"
    else:
        headers["Referer"] = "https://www.bilibili.com/"
    return headers


async def _download_video(url: str, dest: str) -> None:
    headers = _headers_for(url)
    async with httpx.AsyncClient(timeout=TASK_TIMEOUT_SECONDS, follow_redirects=True) as client:
        async with client.stream("GET", url, headers=headers) as resp:
            resp.raise_for_status()
            content_length = resp.headers.get("content-length")
            if content_length and int(content_length) > MAX_VIDEO_BYTES:
                raise RuntimeError(f"视频文件过大（{int(content_length) // 1024 // 1024}MB），上限 500MB")
            with open(dest, "wb") as f:
                async for chunk in resp.aiter_bytes(chunk_size=1024 * 1024):
                    f.write(chunk)
