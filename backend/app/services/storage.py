"""Audio intake: validation, safe storage names, optional ffmpeg normalisation.

Files are validated (extension, declared type, magic bytes, size, duration)
before any provider call. Browser recordings (webm/opus) are converted to
16 kHz mono WAV when ffmpeg is available, since Prisma does not accept webm.
"""

import json
import shutil
import subprocess
import uuid
import wave
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.config import get_settings
from app.core.errors import AppError

ALLOWED = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
    ".m4a": "audio/mp4",
    ".webm": "audio/webm",
}
CONVERT_TO_WAV = {".webm"}


@dataclass
class StoredAudio:
    storage_key: str
    mime_type: str
    size_bytes: int
    duration_seconds: float | None
    original_filename: str
    delete_after: datetime


def _sniff(head: bytes) -> str | None:
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return ".wav"
    if head[:3] == b"ID3" or (len(head) > 1 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0):
        # MP3 frame sync and ADTS AAC share the 0xFFF prefix
        return ".aac" if (len(head) > 1 and (head[1] & 0xF6) == 0xF0) else ".mp3"
    if head[:4] == b"OggS":
        return ".ogg"
    if head[:4] == b"fLaC":
        return ".flac"
    if head[4:8] == b"ftyp":
        return ".m4a"
    if head[:4] == b"\x1a\x45\xdf\xa3":
        return ".webm"
    return None


def storage_root() -> Path:
    root = get_settings().storage_dir
    root.mkdir(parents=True, exist_ok=True)
    return root


def resolve(storage_key: str) -> Path:
    root = storage_root().resolve()
    path = (root / storage_key).resolve()
    if root not in path.parents:
        raise AppError(400, "invalid_storage_key", "Invalid storage reference")
    return path


def _probe_duration(path: Path) -> float | None:
    if path.suffix == ".wav":
        try:
            with wave.open(str(path), "rb") as w:
                return w.getnframes() / float(w.getframerate())
        except (wave.Error, EOFError):
            pass
    if shutil.which("ffprobe"):
        try:
            out = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
                capture_output=True, timeout=20, check=True,
            )
            return float(json.loads(out.stdout)["format"]["duration"])
        except (subprocess.SubprocessError, KeyError, ValueError):
            return None
    return None


def _convert_to_wav(src: Path) -> Path:
    if not shutil.which("ffmpeg"):
        raise AppError(415, "unsupported_audio", "WebM recordings need ffmpeg on the server; upload WAV/MP3 instead")
    dst = src.with_suffix(".wav")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", "16000", str(dst)],
            capture_output=True, timeout=60, check=True,
        )
    except subprocess.SubprocessError:
        raise AppError(400, "audio_conversion_failed", "The recording could not be decoded")
    finally:
        src.unlink(missing_ok=True)
    return dst


def save_audio(organization_id: uuid.UUID, filename: str, content: bytes) -> StoredAudio:
    settings = get_settings()
    if not content:
        raise AppError(400, "empty_audio", "The uploaded audio file is empty")
    if len(content) > settings.max_audio_bytes:
        raise AppError(
            413, "audio_too_large", f"Audio exceeds {settings.max_audio_bytes // (1024 * 1024)} MB limit"
        )
    ext = Path(filename or "").suffix.lower()
    sniffed = _sniff(content[:16])
    if ext not in ALLOWED or sniffed is None:
        raise AppError(
            415, "unsupported_audio", "Supported audio: " + ", ".join(e.lstrip(".") for e in ALLOWED)
        )
    # Trust the content, not the name; MP3/AAC share a sync header so accept either.
    if sniffed != ext and {sniffed, ext} != {".mp3", ".aac"}:
        raise AppError(415, "audio_type_mismatch", "File content does not match its extension")

    folder = storage_root() / "audio" / str(organization_id)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{uuid.uuid4().hex}{ext}"
    path.write_bytes(content)

    if ext in CONVERT_TO_WAV:
        path = _convert_to_wav(path)
    duration = _probe_duration(path)
    if duration is not None and duration > settings.max_audio_seconds:
        path.unlink(missing_ok=True)
        raise AppError(
            400, "audio_too_long",
            f"Recording is {duration:.1f}s; Prisma accepts up to {settings.max_audio_seconds:.0f}s per clip",
        )
    if duration is not None and duration < 0.1:
        path.unlink(missing_ok=True)
        raise AppError(400, "audio_too_short", "Recording is too short to transcribe")

    return StoredAudio(
        storage_key=str(path.relative_to(storage_root())),
        mime_type=ALLOWED[path.suffix],
        size_bytes=path.stat().st_size,
        duration_seconds=round(duration, 2) if duration is not None else None,
        original_filename=Path(filename).name[:255],
        delete_after=datetime.now(timezone.utc) + timedelta(days=settings.audio_retention_days),
    )


def delete_file(storage_key: str | None) -> None:
    if storage_key:
        resolve(storage_key).unlink(missing_ok=True)
