import json
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.db import get_settings
from backend.observability import api_error, api_ok, log_domain_event
from backend.services.indexing_core import extract_urls_from_text

router = APIRouter(prefix='/api/ai', tags=['ai'])


class AIRequest(BaseModel):
    prompt: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    provider: str | None = None


SYSTEM_RULE = 'Return concise, structured JSON without markdown fences.'
MINIMAX_URL = 'https://api.minimaxi.com/v1/text/chatcompletion_v2'
LANGUAGE_LABELS = {
    'en': 'English',
    'de': 'German',
    'es': 'Spanish',
    'fr': 'French',
    'zh': 'Chinese',
}
SITE_CONTEXT = (
    'Target website context: Wavetel IoT (waveteliot.com), a B2B manufacturer focused on industrial routers, '
    'industrial cellular routers, 4G routers, 5G routers, 5G RedCap routers, industrial IoT gateways, '
    'M2M connectivity, edge connectivity, rugged networking equipment, dual-SIM WAN failover, Wi-Fi 6, '
    'Modbus, MQTT, VPN, RS232/RS485, I/O, DIN-rail deployment, and solutions for energy & utility, '
    'smart city, transportation, industrial automation, retail, surveillance, power monitoring, elevator monitoring, '
    'parcel lockers, ATM networking, digital signage, and smart manufacturing. Prefer SEO output suitable for '
    'global English-language B2B buyers and solution searches.'
)


def _extract_json_candidate(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        stripped = stripped.replace("json", "", 1).strip()
    if stripped.startswith("{") or stripped.startswith("["):
        return stripped
    object_start = stripped.find("{")
    array_start = stripped.find("[")
    starts = [value for value in (object_start, array_start) if value >= 0]
    if not starts:
        return stripped
    return stripped[min(starts):]


def build_prompt(feature: str, payload: dict[str, Any]) -> str:
    if feature == 'indexing_url_extract':
        return (
            SYSTEM_RULE
            + ' Extract valid absolute URLs from the input content used for Google indexing submission.'
            + ' Remove duplicates, keep only http/https URLs, and ignore anchors/javascript/mailto.'
            + ' Return strict JSON with schema: {"urls":["https://..."],"notes":"short summary"}'
            + ' Input: '
            + json.dumps(payload, ensure_ascii=False)
        )
    if feature == 'recommend':
        return (
            SYSTEM_RULE
            + ' '
            + SITE_CONTEXT
            + ' Generate SEO keyword ideas for the provided topic. Focus on commercial, product, use-case, and long-tail queries that match the site context.'
            + ' Avoid generic SEO-tool keywords unless the topic explicitly asks about SEO tools.'
            + ' Return strict JSON using this schema: {"items":[{"keyword":"...","type":"core|long-tail|scenario|persona|question|competitor|brand","reason":"short rationale"}]}.'
            + ' Respect the requested count when provided. Keep keywords concise and search-like.'
            + ' Input: '
            + json.dumps(payload, ensure_ascii=False)
        )
    if feature == 'analyze':
        return (
            SYSTEM_RULE
            + ' '
            + SITE_CONTEXT
            + ' Analyze the keyword for B2B SEO. Return strict JSON with keys: summary, intent, audience, suggestions, difficulty, searchVolume.'
            + ' The suggestions field must be an array of concrete content angles or related keywords.'
            + ' Input: '
            + json.dumps(payload, ensure_ascii=False)
        )
    if feature == 'image_plan':
        desired_style = str(payload.get('desired_style') or 'clean product marketing')
        image_count = int(payload.get('image_count') or 6)
        return (
            SYSTEM_RULE
            + ' '
            + SITE_CONTEXT
            + ' Analyze the finished article and decide where images are needed for readability, product explanation, trust, and conversion.'
            + ' Return strict JSON using this schema: {"items":[{"section":"...","reason":"...","image_type":"product|scene|diagram|workflow|comparison|hero","style":"...","prompt":"..."}]}.'
            + ' The prompt must be ready for AI image generation and include subject, environment, composition, lighting, and style.'
            + ' Keep each prompt concise, under 45 words, and avoid long explanations.'
            + ' Keep each reason concise, under 25 words.'
            + f' Only recommend images that materially improve the article. Return no more than {image_count} items.'
            + f' Use this visual style consistently unless the section strongly requires a different subtype: {desired_style}.'
            + ' Input: '
            + json.dumps(payload, ensure_ascii=False)
        )
    content_language = LANGUAGE_LABELS.get(str(payload.get('content_language') or 'en'), 'English')
    content_blocks = payload.get('content_blocks') or []
    return (
        SYSTEM_RULE
        + ' '
        + SITE_CONTEXT
        + f' Generate a GEO content package in {content_language}.'
        + ' Respect the requested article structure and section mix.'
        + f' Requested blocks: {json.dumps(content_blocks, ensure_ascii=False)}.'
        + ' Return strict JSON with keys: brief, title_options, meta_title, meta_description, outline, draft_sections, faq, suggestions.'
        + ' The outline must be an array of strings or an array of section objects.'
        + ' The draft_sections must be an array of objects with heading and content.'
        + ' If FAQ is requested, return faq as an array of {question, answer}.'
        + ' If table_of_contents is requested, make the outline useful and complete.'
        + ' Input: '
        + json.dumps(payload, ensure_ascii=False)
    )


def parse_json_response(text: str, provider: str) -> dict[str, Any]:
    try:
        return json.loads(_extract_json_candidate(text))
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                'code': 'provider_error',
                'provider': provider,
                'message': f'{provider} returned non-JSON content: {text[:300]}',
            },
        ) from exc


async def run_model(provider: str, prompt: str, settings: dict[str, Any], request: Request | None = None) -> dict[str, Any]:
    if provider == 'gemini':
        api_key = settings.get('gemini_api_key')
        if not api_key:
            api_error(status_code=400, code='configuration_required', message='Gemini API key is not configured.', request=request, details={'provider': 'gemini'})
        url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}'
        body = {'contents': [{'parts': [{'text': prompt}]}], 'generationConfig': {'responseMimeType': 'application/json'}}
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(url, json=body)
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502,
                detail={
                    'code': 'provider_error',
                    'provider': 'gemini',
                    'message': f'Gemini network request failed: {exc}',
                },
            ) from exc
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail={'code': 'provider_error', 'provider': 'gemini', 'message': response.text[:500]})
        data = response.json()
        candidates = data.get('candidates') or []
        if not candidates:
            raise HTTPException(status_code=502, detail={'code': 'provider_error', 'provider': 'gemini', 'message': 'Gemini returned no candidates.'})
        text = ((candidates[0].get('content') or {}).get('parts') or [{}])[0].get('text', '{}')
        return parse_json_response(text, provider)

    if provider == 'minimax':
        api_key = settings.get('minimax_api_key')
        if not api_key:
            api_error(status_code=400, code='configuration_required', message='MiniMax API key is not configured.', request=request, details={'provider': 'minimax'})
        body = {
            'model': 'MiniMax-M2.5',
            'messages': [{'role': 'system', 'content': SYSTEM_RULE}, {'role': 'user', 'content': prompt}],
            'stream': False,
            'temperature': 0.3,
            'max_completion_tokens': 4096,
        }
        headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(MINIMAX_URL, json=body, headers=headers)
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502,
                detail={
                    'code': 'provider_error',
                    'provider': 'minimax',
                    'message': f'MiniMax network request failed: {exc}',
                },
            ) from exc
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail={'code': 'provider_error', 'provider': 'minimax', 'message': response.text[:500]})
        data = response.json()
        base_resp = data.get('base_resp') or {}
        if base_resp.get('status_code') not in (None, 0):
            raise HTTPException(
                status_code=502,
                detail={
                    'code': 'provider_error',
                    'provider': 'minimax',
                    'message': base_resp.get('status_msg') or 'MiniMax returned a non-zero status code.',
                },
            )
        choices = data.get('choices') or []
        if not choices:
            raise HTTPException(
                status_code=502,
                detail={
                    'code': 'provider_error',
                    'provider': 'minimax',
                    'message': 'MiniMax returned no choices. Verify the API key, model availability, and account quota.',
                },
            )
        text = (choices[0].get('message') or {}).get('content', '{}')
        return parse_json_response(text, provider)

    api_error(status_code=400, code='provider_error', message=f'Unsupported provider: {provider}', request=request, details={'provider': provider})


def _keyword_text(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get('keyword') or value.get('title') or json.dumps(value, ensure_ascii=False))
    return str(value)


def normalize_recommend_items(data: dict[str, Any]) -> list[dict[str, Any]]:
    if isinstance(data.get('items'), list):
        items = []
        for item in data['items']:
            if isinstance(item, dict):
                items.append({
                    'keyword': _keyword_text(item),
                    'type': item.get('type', 'generated'),
                    'reason': item.get('reason', item.get('intent', 'generated')),
                })
            else:
                items.append({'keyword': _keyword_text(item), 'type': 'generated', 'reason': 'generated'})
        return items

    items: list[dict[str, Any]] = []
    for bucket_name in ('intent', 'type'):
        bucket = data.get(bucket_name)
        if not isinstance(bucket, dict):
            continue
        for sub_type, values in bucket.items():
            if isinstance(values, list):
                for value in values:
                    items.append({'keyword': _keyword_text(value), 'type': sub_type, 'reason': bucket_name})

    if not items:
        for key, value in data.items():
            if isinstance(value, list):
                for entry in value:
                    items.append({'keyword': _keyword_text(entry), 'type': key, 'reason': 'generated'})

    return items


def normalize_outline(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        sections = value.get('sections')
        if isinstance(sections, list):
            return sections
    return []


def normalize_sections(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        items: list[dict[str, Any]] = []
        for key, content in value.items():
            heading = str(key).replace('_', ' ').strip().title()
            if isinstance(content, dict):
                items.append({'heading': content.get('heading') or heading, 'content': content.get('content') or json.dumps(content, ensure_ascii=False)})
            else:
                items.append({'heading': heading, 'content': str(content)})
        return items
    return []


def normalize_faq(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def normalize_string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    return []


def normalize_brief(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        return {'summary': value.strip()}
    return {}


def normalize_image_plan_items(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    items: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        items.append(
            {
                'section': str(item.get('section', 'Untitled section')),
                'reason': str(item.get('reason', 'Supports comprehension and conversion')),
                'image_type': str(item.get('image_type', 'scene')),
                'style': str(item.get('style', item.get('visual_style', 'clean product marketing'))),
                'prompt': str(item.get('prompt', '')),
            }
        )
    return items


def normalize_result(feature: str, data: dict[str, Any], provider: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = payload or {}
    if feature == 'indexing_url_extract':
        urls = normalize_string_list(data.get('urls', []))
        cleaned = []
        seen: set[str] = set()
        for url in urls:
            candidate = url.strip()
            if not candidate.startswith(('http://', 'https://')):
                continue
            if candidate in seen:
                continue
            seen.add(candidate)
            cleaned.append(candidate)
        return {
            'provider': provider,
            'status': 'success',
            'urls': cleaned,
            'notes': str(data.get('notes', '')),
        }
    if feature == 'recommend':
        return {'provider': provider, 'items': normalize_recommend_items(data), 'status': 'success'}
    if feature == 'analyze':
        return {
            'provider': provider,
            'status': 'success',
            'summary': data.get('summary', ''),
            'intent': data.get('intent', ''),
            'audience': data.get('audience', ''),
            'suggestions': data.get('suggestions', []) or data.get('contentSuggestions', []) or data.get('relatedKws', []),
            'difficulty': data.get('difficulty', ''),
            'searchVolume': data.get('searchVolume', ''),
        }
    if feature == 'image_plan':
        items = normalize_image_plan_items(data.get('items', []))
        limit = int(payload.get('image_count') or 0)
        if limit > 0:
            items = items[:limit]
        return {'provider': provider, 'items': items, 'status': 'success'}
    draft_sections = normalize_sections(data.get('draft_sections', []))
    outline = normalize_outline(data.get('outline', []))
    if not outline and draft_sections:
        outline = [section.get('heading', 'Section') for section in draft_sections]
    return {
        'provider': provider,
        'status': 'success',
        'brief': normalize_brief(data.get('brief', {})),
        'title_options': normalize_string_list(data.get('title_options', [])),
        'meta_title': data.get('meta_title', ''),
        'meta_description': data.get('meta_description', ''),
        'outline': outline,
        'draft_sections': draft_sections,
        'faq': normalize_faq(data.get('faq', [])),
        'suggestions': normalize_string_list(data.get('suggestions', [])),
    }


async def execute(feature: str, payload: dict[str, Any], provider_override: str | None = None, request: Request | None = None):
    settings = get_settings()
    provider = provider_override or settings.get('default_ai_provider') or 'gemini'
    prompt = build_prompt(feature, payload)
    data = await run_model(provider, prompt, settings, request)
    log_domain_event(f'ai.{feature}', request=request, meta={'provider': provider})
    return normalize_result(feature, data, provider, payload)


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
        # Graceful fallback when AI is not configured or provider is unavailable.
        if detail.get('code') in {'configuration_required', 'provider_error'}:
            log_domain_event('ai.indexing_url_extract.fallback', request=request, meta={'provider': detail.get('details', {}).get('provider', '')})
            return api_ok(request, **{
                'provider': 'local-parser',
                'status': 'fallback',
                'urls': extract_urls_from_text(raw_text),
                'notes': 'AI unavailable, used local parser fallback.',
            })
        raise
