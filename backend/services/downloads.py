from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.config import AppSettings

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RELEASE_ZIP_PATH = PROJECT_ROOT / "release" / "SmartKey-portable.zip"
DOWNLOAD_URL = "/downloads/SmartKey-portable.zip"
DOWNLOAD_FILENAME = "SmartKey-portable.zip"
DOWNLOAD_PLATFORM = "Windows x64 Portable"


def _iso_from_mtime(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()


def latest_download_metadata(settings: AppSettings) -> dict[str, Any]:
    available = RELEASE_ZIP_PATH.exists() and RELEASE_ZIP_PATH.is_file()
    metadata: dict[str, Any] = {
        "available": available,
        "version": settings.app_version,
        "platform": DOWNLOAD_PLATFORM,
        "filename": DOWNLOAD_FILENAME,
        "sizeBytes": 0,
        "downloadUrl": DOWNLOAD_URL,
        "updatedAt": "",
    }
    if available:
        metadata["sizeBytes"] = RELEASE_ZIP_PATH.stat().st_size
        metadata["updatedAt"] = _iso_from_mtime(RELEASE_ZIP_PATH)
    return metadata


def latest_download_path() -> Path:
    return RELEASE_ZIP_PATH
