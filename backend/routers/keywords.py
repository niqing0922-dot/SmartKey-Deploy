from fastapi import APIRouter, Request
from pydantic import BaseModel

from backend import db
from backend.data_context import get_data_context
from backend.observability import api_error, api_ok, log_domain_event
from backend.repositories import cloud

router = APIRouter(prefix="/api/db", tags=["keywords"])


class KeywordPayload(BaseModel):
    keyword: str
    type: str = "core"
    priority: str = "medium"
    status: str = "pending"
    notes: str = ""
    position: str = ""
    related_article: str = ""


@router.get("/keywords")
def get_keywords(request: Request, status: str | None = None, type: str | None = None, priority: str | None = None, search: str | None = None):
    data_ctx = get_data_context(request)
    filters = {"status": status, "type": type, "priority": priority, "search": search}
    items = cloud.list_keywords(data_ctx.cloud, filters) if data_ctx.is_cloud else db.list_keywords(filters)
    return api_ok(request, items=items)


@router.post("/keywords")
def post_keyword(payload: KeywordPayload, request: Request):
    data_ctx = get_data_context(request)
    item = cloud.create_keyword(data_ctx.cloud, payload.model_dump()) if data_ctx.is_cloud else db.create_keyword(payload.model_dump())
    log_domain_event("keyword.create", request=request, meta={"keyword_id": item["id"]})
    return api_ok(request, item=item)


@router.put("/keywords/{keyword_id}")
def put_keyword(keyword_id: str, payload: KeywordPayload, request: Request):
    data_ctx = get_data_context(request)
    item = cloud.update_keyword(data_ctx.cloud, keyword_id, payload.model_dump()) if data_ctx.is_cloud else db.update_keyword(keyword_id, payload.model_dump())
    if not item:
        api_error(status_code=404, code="keyword_not_found", message="Keyword not found.", request=request)
    log_domain_event("keyword.update", request=request, meta={"keyword_id": keyword_id})
    return api_ok(request, item=item)


@router.delete("/keywords/{keyword_id}")
def remove_keyword(keyword_id: str, request: Request):
    data_ctx = get_data_context(request)
    existing = cloud.get_keyword(data_ctx.cloud, keyword_id) if data_ctx.is_cloud else db.get_keyword(keyword_id)
    if not existing:
        api_error(status_code=404, code="keyword_not_found", message="Keyword not found.", request=request)
    if data_ctx.is_cloud:
        cloud.delete_keyword(data_ctx.cloud, keyword_id)
    else:
        db.delete_keyword(keyword_id)
    log_domain_event("keyword.delete", request=request, meta={"keyword_id": keyword_id})
    return api_ok(request)
