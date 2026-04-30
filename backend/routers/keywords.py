from fastapi import APIRouter, Request
from pydantic import BaseModel

from backend.auth import require_cloud_context
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
    ctx = require_cloud_context(request)
    return api_ok(request, items=cloud.list_keywords(ctx, {"status": status, "type": type, "priority": priority, "search": search}))


@router.post("/keywords")
def post_keyword(payload: KeywordPayload, request: Request):
    ctx = require_cloud_context(request)
    item = cloud.create_keyword(ctx, payload.model_dump())
    log_domain_event("keyword.create", request=request, meta={"keyword_id": item["id"]})
    return api_ok(request, item=item)


@router.put("/keywords/{keyword_id}")
def put_keyword(keyword_id: str, payload: KeywordPayload, request: Request):
    ctx = require_cloud_context(request)
    item = cloud.update_keyword(ctx, keyword_id, payload.model_dump())
    if not item:
        api_error(status_code=404, code="keyword_not_found", message="Keyword not found.", request=request)
    log_domain_event("keyword.update", request=request, meta={"keyword_id": keyword_id})
    return api_ok(request, item=item)


@router.delete("/keywords/{keyword_id}")
def remove_keyword(keyword_id: str, request: Request):
    ctx = require_cloud_context(request)
    if not cloud.get_keyword(ctx, keyword_id):
        api_error(status_code=404, code="keyword_not_found", message="Keyword not found.", request=request)
    cloud.delete_keyword(ctx, keyword_id)
    log_domain_event("keyword.delete", request=request, meta={"keyword_id": keyword_id})
    return api_ok(request)
