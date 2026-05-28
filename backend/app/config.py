import os
import shutil


VOLC_APP_ID = os.getenv("VOLC_APP_ID", "")
VOLC_ACCESS_TOKEN = os.getenv("VOLC_ACCESS_TOKEN", "")

ASR_RESOURCE_ID = "volc.bigasr.auc_turbo"
ASR_ENDPOINT = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash"

TEMP_DIR = "/tmp/video-parser"


def _find_ffmpeg() -> str:
    explicit = os.getenv("FFMPEG_PATH", "")
    if explicit:
        return explicit
    # On Windows, check common install locations
    if os.name == "nt":
        candidates = [
            r"D:\ffmpeg\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe",
            r"C:\ffmpeg\bin\ffmpeg.exe",
        ]
        for p in candidates:
            if os.path.isfile(p):
                return p
    return shutil.which("ffmpeg") or "ffmpeg"


FFMPEG_PATH = _find_ffmpeg()

TASK_TIMEOUT_SECONDS = 300
