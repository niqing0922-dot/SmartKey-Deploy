from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from backend.db import (
    create_backup,
    export_snapshot,
    import_snapshot,
    list_backups,
    local_data_summary,
    reset_local_data,
)
from backend.observability import api_error, api_ok, log_domain_event
from backend.repositories.articles import (
    create_article,
    delete_article,
    get_article,
    list_articles,
    update_article,
)
from backend.repositories.keywords import (
    create_keyword,
    delete_keyword,
    get_keyword,
    list_keywords,
    update_keyword,
)

router = APIRouter(prefix="/api/db", tags=["db"])
local_router = APIRouter(prefix="/api/local-data", tags=["local-data"])


class KeywordPayload(BaseModel):
    keyword: str
    type: str = "core"
    priority: str = "medium"
    status: str = "pending"
    notes: str = ""
    position: str = ""
    related_article: str = ""


class ArticlePayload(BaseModel):
    title: str
    content: str = ""
    status: str = "draft"
    keyword_ids: list[str] = Field(default_factory=list)


class SnapshotPayload(BaseModel):
    snapshot: dict[str, Any]


class ResetPayload(BaseModel):
    mode: str = "content"


@router.get("/keywords")
def get_keywords(request: Request, status: str | None = None, type: str | None = None, priority: str | None = None, search: str | None = None):
    return api_ok(request, items=list_keywords({"status": status, "type": type, "priority": priority, "search": search}))


@router.post("/keywords")
def post_keyword(payload: KeywordPayload, request: Request):
    item = create_keyword(payload.model_dump())
    log_domain_event("keyword.create", request=request, meta={"keyword_id": item["id"]})
    return api_ok(request, item=item)


@router.put("/keywords/{keyword_id}")
def put_keyword(keyword_id: str, payload: KeywordPayload, request: Request):
    item = update_keyword(keyword_id, payload.model_dump())
    if not item:
        api_error(status_code=404, code="keyword_not_found", message="Keyword not found.", request=request)
    log_domain_event("keyword.update", request=request, meta={"keyword_id": keyword_id})
    return api_ok(request, item=item)


@router.delete("/keywords/{keyword_id}")
def remove_keyword(keyword_id: str, request: Request):
    if not get_keyword(keyword_id):
        api_error(status_code=404, code="keyword_not_found", message="Keyword not found.", request=request)
    delete_keyword(keyword_id)
    log_domain_event("keyword.delete", request=request, meta={"keyword_id": keyword_id})
    return api_ok(request)


@router.get("/articles")
def get_articles(request: Request):
    return api_ok(request, items=list_articles())


@router.post("/articles")
def post_article(payload: ArticlePayload, request: Request):
    item = create_article(payload.model_dump())
    log_domain_event("article.create", request=request, meta={"article_id": item["id"]})
    return api_ok(request, item=item)


@router.put("/articles/{article_id}")
def put_article(article_id: str, payload: ArticlePayload, request: Request):
    item = update_article(article_id, payload.model_dump())
    if not item:
        api_error(status_code=404, code="article_not_found", message="Article not found.", request=request)
    log_domain_event("article.update", request=request, meta={"article_id": article_id})
    return api_ok(request, item=item)


@router.delete("/articles/{article_id}")
def remove_article(article_id: str, request: Request):
    if not get_article(article_id):
        api_error(status_code=404, code="article_not_found", message="Article not found.", request=request)
    delete_article(article_id)
    log_domain_event("article.delete", request=request, meta={"article_id": article_id})
    return api_ok(request)


@router.get("/export")
def export_data(request: Request):
    return api_ok(request, snapshot=export_snapshot())


@router.post("/import")
def import_data(payload: SnapshotPayload, request: Request):
    import_snapshot(payload.snapshot)
    log_domain_event("local.import", request=request)
    return api_ok(request)


@local_router.get("/summary")
def get_local_summary(request: Request):
    return api_ok(request, summary=local_data_summary())


@local_router.get("/export")
def export_local_data(request: Request):
    return api_ok(request, snapshot=export_snapshot())


@local_router.get("/backups")
def get_backups(request: Request):
    return api_ok(request, items=list_backups())


@local_router.post("/backup")
def create_local_backup(request: Request):
    path = create_backup()
    log_domain_event("backup.create", request=request, meta={"path": path})
    return api_ok(request, path=path)


@local_router.post("/import")
def import_local_data(payload: SnapshotPayload, request: Request):
    import_snapshot(payload.snapshot)
    log_domain_event("local.import", request=request)
    return api_ok(request)


@local_router.post("/reset")
def reset_data(payload: ResetPayload, request: Request):
    reset_local_data(payload.mode)
    log_domain_event("local.reset", request=request, meta={"mode": payload.mode})
    return api_ok(request, mode=payload.mode)
