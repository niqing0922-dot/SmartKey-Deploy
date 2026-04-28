from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.observability import api_error, api_ok, log_domain_event
from backend.services.ai_service import execute
from backend.services.indexing_core import extract_urls_from_text

router = APIRouter(prefix='/api/ai', tags=['ai'])


class AIRequest(BaseModel):
    prompt: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    provider: str | None = None


@router.post('/recommend')
async def recommend(payload: AIRequest, request: Request):
    return api_ok(request, **(await execute('recommend', payload.payload, payload.provider, request)))


@router.post('/analyze')
async def analyze(payload: AIRequest, request: Request):
    return api_ok(request, **(await execute('analyze', payload.payload, payload.provider, request)))


@router.post('/geo-brief')
async def geo_brief(payload: AIRequest, request: Request):
    return api_ok(request, **(await execute('geo', payload.payload, payload.provider, request)))


@router.post('/geo-outline')
async def geo_outline(payload: AIRequest, request: Request):
    return api_ok(request, **(await execute('geo', payload.payload, payload.provider, request)))


@router.post('/geo-draft')
async def geo_draft(payload: AIRequest, request: Request):
    return api_ok(request, **(await execute('geo', payload.payload, payload.provider, request)))


@router.post('/image-plan')
async def image_plan(payload: AIRequest, request: Request):
    return api_ok(request, **(await execute('image_plan', payload.payload, payload.provider, request)))


@router.post('/chat')
async def chat(payload: AIRequest, request: Request):
    result = await execute('analyze', payload.payload or {'message': payload.prompt or ''}, payload.provider, request)
    return api_ok(request, provider=result['provider'], reply=result.get('summary') or result.get('intent') or '')


@router.post('/indexing-url-extract')
async def indexing_url_extract(payload: AIRequest, request: Request):
    input_payload = payload.payload or {}
    raw_text = str(input_payload.get('text') or '')
    if not raw_text.strip():
        api_error(status_code=400, code='invalid_input', message='text is required', request=request)
    try:
        return api_ok(request, **(await execute('indexing_url_extract', input_payload, payload.provider, request)))
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {'message': str(exc.detail)}
        if detail.get('code') in {'configuration_required', 'provider_error'}:
            log_domain_event('ai.indexing_url_extract.fallback', request=request, meta={'provider': detail.get('details', {}).get('provider', '')})
            return api_ok(
                request,
                **{
                    'provider': 'local-parser',
                    'status': 'fallback',
                    'urls': extract_urls_from_text(raw_text),
                    'notes': 'AI unavailable, used local parser fallback.',
                },
            )
        raise
