// Vercel Edge Function — 视频解析（开发回退 / 独立部署场景）
// POST /api/parse  { url: string }
// 生产环境建议通过 VITE_API_BASE_URL 指向 Render 后端

const TIMEOUT_MS = 12_000;

const BILIBILI_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com/',
};

function detectPlatform(url: string): string | null {
  if (/douyin\.com|iesdouyin\.com/i.test(url)) return 'douyin';
  if (/kuaishou\.com|gifshow\.com/i.test(url)) return 'kuaishou';
  if (/bilibili\.com|b23\.tv|b22\.tv/i.test(url)) return 'bilibili';
  return null;
}

function extractBvid(url: string): string | null {
  const m = url.match(/BV[a-zA-Z0-9]{10}/);
  if (m) return m[0];
  const av = url.match(/\/av(\d+)/i);
  return av ? av[1] : null;
}

async function parseBilibili(url: string) {
  let targetUrl = url;

  // 解析短链接
  if (/b23\.tv|b22\.tv/i.test(url)) {
    try {
      const redir = await fetch(url, { redirect: 'manual', headers: BILIBILI_HEADERS });
      const loc = redir.headers.get('location');
      if (loc) {
        targetUrl = loc.startsWith('http') ? loc : `https://www.bilibili.com${loc}`;
      }
    } catch {
      // 短链接解析失败，继续用原 URL 尝试
    }
  }

  const bvid = extractBvid(targetUrl);
  if (!bvid) {
    return Response.json(
      { code: 400, msg: '无法从链接中提取 B 站视频 ID' },
      { status: 400 },
    );
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // 获取视频信息
    const infoResp = await fetch(
      `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
      { headers: BILIBILI_HEADERS, signal: controller.signal },
    );
    const info = await infoResp.json();

    if (info.code !== 0) {
      clearTimeout(timer);
      return Response.json(
        { code: 502, msg: info.message || 'B站接口返回错误' },
        { status: 502 },
      );
    }

    const { title, owner, pic, cid } = info.data;

    // 获取下载地址
    let videoUrl = '';
    if (cid) {
      const playResp = await fetch(
        `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=80&fnval=1&fourk=1`,
        { headers: BILIBILI_HEADERS, signal: controller.signal },
      );
      const playData = await playResp.json();
      if (playData.code === 0 && playData.data?.durl?.length > 0) {
        videoUrl = playData.data.durl[0].url;
      }
    }

    clearTimeout(timer);

    return Response.json({
      code: 200,
      data: {
        platform: 'bilibili',
        title: title || '',
        author: owner?.name || '',
        cover: String(pic || '').replace('http://', 'https://'),
        video_url: videoUrl,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return Response.json(
        { code: 504, msg: 'B站接口响应超时，请稍后重试' },
        { status: 504 },
      );
    }
    return Response.json(
      { code: 500, msg: '服务繁忙，请稍后重试' },
      { status: 500 },
    );
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ code: 405, msg: 'Method not allowed' }, { status: 405 });
  }

  let url: string;
  try {
    const body = await req.json();
    url = (body.url || '').trim();
  } catch {
    return Response.json({ code: 400, msg: '请求格式错误' }, { status: 400 });
  }

  if (!url) {
    return Response.json({ code: 400, msg: '请提供视频链接' }, { status: 400 });
  }

  const platform = detectPlatform(url);
  if (!platform) {
    return Response.json(
      { code: 400, msg: '暂不支持该平台，目前支持抖音、快手、B站' },
      { status: 400 },
    );
  }

  if (platform === 'bilibili') {
    return parseBilibili(url);
  }

  // 抖音/快手需要自部署后端服务
  return Response.json(
    {
      code: 502,
      msg: '抖音/快手解析需要后端服务支持，请部署完整后端或将 VITE_API_BASE_URL 指向 Render 后端',
    },
    { status: 502 },
  );
}

export const config = { runtime: 'edge' };
