import asyncio
import os
import subprocess
import httpx
from app.config import (
    VOLC_APP_ID,
    VOLC_ACCESS_TOKEN,
    ASR_ENDPOINT,
    ASR_RESOURCE_ID,
    FFMPEG_PATH,
    TEMP_DIR,
)


async def extract_audio(video_path: str, audio_path: str) -> None:
    """Extract audio from video using FFmpeg."""
    cmd = [
        FFMPEG_PATH, "-i", video_path,
        "-vn", "-acodec", "libmp3lame",
        "-b:a", "64k", "-ar", "16000", "-ac", "1",
        audio_path, "-y",
    ]
    loop = asyncio.get_running_loop()
    try:
        result = await asyncio.wait_for(
            loop.run_in_executor(None, _run_ffmpeg, cmd),
            timeout=120,
        )
    except asyncio.TimeoutError:
        raise RuntimeError("FFmpeg 提取音频超时")
    if result != 0:
        raise RuntimeError(f"FFmpeg 退出码: {result}")


def _run_ffmpeg(cmd: list) -> int:
    return subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode


async def transcribe_audio(audio_path: str) -> str:
    """Send audio to Doubao ASR (or local faster-whisper fallback)."""
    os.makedirs(TEMP_DIR, exist_ok=True)

    if VOLC_APP_ID and VOLC_ACCESS_TOKEN:
        return await _transcribe_doubao(audio_path)
    return await _transcribe_local(audio_path)


async def _transcribe_doubao(audio_path: str) -> str:
    async with httpx.AsyncClient(timeout=300) as client:
        with open(audio_path, "rb") as f:
            files = {"audio": f}
            headers = {
                "X-Api-App-Key": VOLC_APP_ID,
                "X-Api-Access-Key": VOLC_ACCESS_TOKEN,
                "X-Api-Resource-Id": ASR_RESOURCE_ID,
            }
            resp = await client.post(ASR_ENDPOINT, files=files, headers=headers)
            data = resp.json()

    if data.get("code") != 0:
        raise RuntimeError(f"ASR failed: {data.get('message', 'unknown error')}")

    return data.get("data", {}).get("text", "")


async def _transcribe_local(audio_path: str) -> str:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _transcribe_faster_whisper, audio_path)


def _transcribe_faster_whisper(audio_path: str) -> str:
    from faster_whisper import WhisperModel

    model = WhisperModel("small", device="cpu", compute_type="auto")
    segments, _ = model.transcribe(audio_path, language="zh")
    return "".join(seg.text for seg in segments)
