import type { ParseResponse, TranscribeResponse, VideoInfo } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/** POST /api/parse — 解析视频链接 */
export async function parseVideoUrl(url: string): Promise<VideoInfo> {
  const resp = await fetch(`${API_BASE}/api/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim() }),
  });

  const data: ParseResponse = await resp.json();

  if (data.code !== 200 || !data.data) {
    throw new Error(data.msg || '解析失败，请检查链接是否正确');
  }

  return data.data;
}

/** 通过后端代理下载视频，绕过 B 站防盗链 */
export function downloadVideo(videoUrl: string): void {
  const downloadUrl = `${API_BASE}/api/download?url=${encodeURIComponent(videoUrl)}`;
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** POST /api/transcribe — 提交转写任务，返回 task_id */
export async function createTranscribeTask(videoUrl: string): Promise<string> {
  const resp = await fetch(`${API_BASE}/api/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: videoUrl }),
  });

  const data: TranscribeResponse = await resp.json();

  if (data.code !== 202 || !data.task_id) {
    throw new Error(data.msg || '提交转写任务失败');
  }

  return data.task_id;
}

/** GET /api/transcribe/:taskId — 轮询转写状态 */
export async function pollTranscribeTask(taskId: string): Promise<TranscribeResponse> {
  const resp = await fetch(`${API_BASE}/api/transcribe/${taskId}`);
  return resp.json();
}
