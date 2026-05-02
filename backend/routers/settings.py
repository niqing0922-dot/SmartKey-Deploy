from fastapi import APIRouter, Request
from pydantic import BaseModel

from backend.data_context import get_data_context
from backend.observability import api_ok, log_domain_event
from backend.repositories import cloud
from backend.repositories.settings import get_settings, public_settings, save_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsPayload(BaseModel):
    language: str | None = None
    default_market: str | None = None
    default_tone: str | None = None
    default_article_type: str | None = None
    default_content_language: str | None = None


@router.get("")
def read_settings(request: Request):
    data_ctx = get_data_context(request)
    runtime = cloud.get_settings(data_ctx.cloud) if data_ctx.is_cloud else get_settings()
    return api_ok(request, settings=public_settings(runtime, runtime_settings=runtime))


@router.post("")
def write_settings(payload: SettingsPayload, request: Request):
    data_ctx = get_data_context(request)
    patch = payload.model_dump(exclude_none=True)
    runtime = cloud.save_settings(data_ctx.cloud, patch) if data_ctx.is_cloud else save_settings(patch)
    log_domain_event("settings.save", request=request, meta={"keys": sorted(patch.keys())})
    return api_ok(request, settings=public_settings(runtime, runtime_settings=runtime))
