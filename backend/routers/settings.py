from fastapi import APIRouter, Request
from pydantic import BaseModel

from backend.db import get_settings, public_settings, save_settings
from backend.observability import api_ok, log_domain_event

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsPayload(BaseModel):
    language: str | None = None
    default_market: str | None = None
    default_tone: str | None = None
    default_article_type: str | None = None
    default_content_language: str | None = None
    rank_target_domain: str | None = None
    default_ai_provider: str | None = None
    default_seo_api: str | None = None
    gemini_enabled: bool | None = None
    minimax_enabled: bool | None = None
    openai_enabled: bool | None = None
    anthropic_enabled: bool | None = None
    deepseek_enabled: bool | None = None
    qwen_enabled: bool | None = None
    moonshot_enabled: bool | None = None
    grok_enabled: bool | None = None
    cohere_enabled: bool | None = None
    minimax_api_key: str | None = None
    gemini_api_key: str | None = None
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    deepseek_api_key: str | None = None
    qwen_api_key: str | None = None
    moonshot_api_key: str | None = None
    grok_api_key: str | None = None
    cohere_api_key: str | None = None
    serpapi_key: str | None = None
    serpapi_enabled: bool | None = None
    dataforseo_api_login: str | None = None
    dataforseo_api_password: str | None = None
    dataforseo_enabled: bool | None = None
    python_path: str | None = None
    google_credentials_path: str | None = None
    indexing_enabled: bool | None = None
    last_enabled_ai_provider: str | None = None
    last_enabled_seo_provider: str | None = None


@router.get("")
def read_settings(request: Request):
    return api_ok(request, settings=public_settings(get_settings()))


@router.post("")
def write_settings(payload: SettingsPayload, request: Request):
    patch = payload.model_dump(exclude_none=True)
    settings = save_settings(patch)
    log_domain_event("settings.save", request=request, meta={"keys": sorted(patch.keys())})
    return api_ok(request, settings=public_settings(settings))
