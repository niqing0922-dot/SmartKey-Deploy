from fastapi import APIRouter, Request
from fastapi.responses import FileResponse

from backend.config import get_app_settings
from backend.observability import api_error, api_ok
from backend.services.downloads import DOWNLOAD_FILENAME, latest_download_metadata, latest_download_path

router = APIRouter(tags=["downloads"])


@router.get("/api/downloads/latest")
def get_latest_download(request: Request):
    return api_ok(request, download=latest_download_metadata(get_app_settings()))


@router.get("/downloads/SmartKey-portable.zip")
def download_portable_zip(request: Request):
    zip_path = latest_download_path()
    if not zip_path.exists() or not zip_path.is_file():
        api_error(
            status_code=404,
            code="download_not_found",
            message="SmartKey portable package has not been built yet.",
            request=request,
        )
    return FileResponse(zip_path, filename=DOWNLOAD_FILENAME, media_type="application/zip")
