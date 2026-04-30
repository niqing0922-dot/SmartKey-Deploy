from io import BytesIO
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.data_context import get_data_context
from backend.observability import api_error, api_ok, log_domain_event
from backend.repositories import articles as local_articles
from backend.repositories import cloud
from backend.repositories import geo_drafts as local_geo_drafts
from backend.repositories.settings import get_runtime_settings
from backend.services.ai_service import execute
from backend.services.geo_export import build_docx, build_markdown

router = APIRouter(prefix="/api/geo-writer", tags=["geo-writer"])


class GeoDraftRequest(BaseModel):
    title: str = ""
    primary_keyword: str
    secondary_keywords: list[str] = Field(default_factory=list)
    audience: str = ""
    industry: str = ""
    target_market: str = ""
    article_type: str = ""
    tone: str = ""
    target_length: int = 1200
    content_language: str = "en"
    content_blocks: list[str] = Field(default_factory=list)


class SaveDraftRequest(BaseModel):
    draft_id: str


def _safe_filename(title: str, extension: str) -> str:
    cleaned = title.replace("/", "-").replace("\\", "-").strip() or "smartkey-draft"
    return f"{cleaned}.{extension}"


@router.get("/drafts")
def get_drafts(request: Request):
    data_ctx = get_data_context(request)
    items = cloud.list_geo_drafts(data_ctx.cloud) if data_ctx.is_cloud else local_geo_drafts.list_geo_drafts()
    return api_ok(request, items=items)


@router.post("/draft")
async def create_draft(payload: GeoDraftRequest, request: Request):
    data_ctx = get_data_context(request)
    if not payload.primary_keyword.strip():
        api_error(status_code=400, code="invalid_input", message="Primary keyword is required.", request=request)
    settings = get_runtime_settings()
    effective: dict[str, Any] = payload.model_dump()
    effective["target_market"] = effective["target_market"] or settings["default_market"]
    effective["article_type"] = effective["article_type"] or settings["default_article_type"]
    effective["tone"] = effective["tone"] or settings["default_tone"]
    effective["content_language"] = effective["content_language"] or settings.get("default_content_language", "en")
    result = await execute("geo", effective, request=request)
    brief = result.get("brief", {}) if isinstance(result.get("brief", {}), dict) else {}
    brief.update(
        {
            "content_language": payload.content_language,
            "content_blocks": payload.content_blocks,
            "requested_title": payload.title,
        }
    )
    requested_title = payload.title.strip()
    draft_payload = {
            "title": requested_title or (result.get("title_options") or [f"{payload.primary_keyword} guide"])[0],
            "primary_keyword": payload.primary_keyword,
            "secondary_keywords": payload.secondary_keywords,
            "audience": payload.audience,
            "industry": payload.industry,
            "target_market": effective["target_market"],
            "article_type": effective["article_type"],
            "tone": effective["tone"],
            "target_length": payload.target_length,
            "brief": brief,
            "title_options": result.get("title_options", []),
            "meta_title": result.get("meta_title", ""),
            "meta_description": result.get("meta_description", ""),
            "outline": result.get("outline", []),
            "draft_sections": result.get("draft_sections", []),
            "faq": result.get("faq", []),
            "suggestions": result.get("suggestions", []),
            "provider": result.get("provider", settings["default_ai_provider"]),
            "status": result.get("status", "draft"),
    }
    draft = cloud.save_geo_draft(data_ctx.cloud, draft_payload) if data_ctx.is_cloud else local_geo_drafts.save_geo_draft(draft_payload)
    log_domain_event("geo.draft.generate", request=request, meta={"draft_id": draft["id"]})
    return api_ok(request, item=draft)


@router.post("/save")
def save_to_articles(payload: SaveDraftRequest, request: Request):
    data_ctx = get_data_context(request)
    draft = cloud.get_geo_draft(data_ctx.cloud, payload.draft_id) if data_ctx.is_cloud else local_geo_drafts.get_geo_draft(payload.draft_id)
    if not draft:
        api_error(status_code=404, code="draft_not_found", message="Draft not found.", request=request)
    content_parts = []
    for section in draft.get("draft_sections", []):
        heading = section.get("heading", "")
        body = section.get("content", "")
        content_parts.append(f"## {heading}\n\n{body}".strip())
    for item in draft.get("faq", []):
        content_parts.append(f"Q: {item.get('question', '')}\nA: {item.get('answer', '')}".strip())
    article_payload = {"title": draft["title"], "content": "\n\n".join(content_parts), "status": "draft", "keyword_ids": []}
    article = cloud.create_article(data_ctx.cloud, article_payload) if data_ctx.is_cloud else local_articles.create_article(article_payload)
    draft["status"] = "saved"
    updated = cloud.save_geo_draft(data_ctx.cloud, draft) if data_ctx.is_cloud else local_geo_drafts.save_geo_draft(draft)
    log_domain_event("geo.draft.save", request=request, meta={"draft_id": payload.draft_id, "article_id": article["id"]})
    return api_ok(request, article=article, draft=updated)


@router.get("/export/{draft_id}.md")
def export_markdown(draft_id: str, request: Request):
    data_ctx = get_data_context(request)
    draft = cloud.get_geo_draft(data_ctx.cloud, draft_id) if data_ctx.is_cloud else local_geo_drafts.get_geo_draft(draft_id)
    if not draft:
        api_error(status_code=404, code="draft_not_found", message="Draft not found.", request=request)
    content = build_markdown(draft).encode("utf-8")
    filename = _safe_filename(str(draft["title"]), "md")
    log_domain_event("geo.draft.export", request=request, meta={"draft_id": draft_id, "format": "md"})
    return StreamingResponse(
        BytesIO(content),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/{draft_id}.docx")
def export_docx(draft_id: str, request: Request):
    data_ctx = get_data_context(request)
    draft = cloud.get_geo_draft(data_ctx.cloud, draft_id) if data_ctx.is_cloud else local_geo_drafts.get_geo_draft(draft_id)
    if not draft:
        api_error(status_code=404, code="draft_not_found", message="Draft not found.", request=request)
    content = build_docx(draft)
    filename = _safe_filename(str(draft["title"]), "docx")
    log_domain_event("geo.draft.export", request=request, meta={"draft_id": draft_id, "format": "docx"})
    return StreamingResponse(
        BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
