from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from backend import db
from backend.data_context import get_data_context
from backend.observability import api_error, api_ok, log_domain_event
from backend.repositories import cloud

router = APIRouter(prefix="/api/db", tags=["articles"])


class ArticlePayload(BaseModel):
    title: str
    content: str = ""
    status: str = "draft"
    keyword_ids: list[str] = Field(default_factory=list)


@router.get("/articles")
def get_articles(request: Request):
    data_ctx = get_data_context(request)
    items = cloud.list_articles(data_ctx.cloud) if data_ctx.is_cloud else db.list_articles()
    return api_ok(request, items=items)


@router.post("/articles")
def post_article(payload: ArticlePayload, request: Request):
    data_ctx = get_data_context(request)
    item = cloud.create_article(data_ctx.cloud, payload.model_dump()) if data_ctx.is_cloud else db.create_article(payload.model_dump())
    log_domain_event("article.create", request=request, meta={"article_id": item["id"]})
    return api_ok(request, item=item)


@router.put("/articles/{article_id}")
def put_article(article_id: str, payload: ArticlePayload, request: Request):
    data_ctx = get_data_context(request)
    item = cloud.update_article(data_ctx.cloud, article_id, payload.model_dump()) if data_ctx.is_cloud else db.update_article(article_id, payload.model_dump())
    if not item:
        api_error(status_code=404, code="article_not_found", message="Article not found.", request=request)
    log_domain_event("article.update", request=request, meta={"article_id": article_id})
    return api_ok(request, item=item)


@router.delete("/articles/{article_id}")
def remove_article(article_id: str, request: Request):
    data_ctx = get_data_context(request)
    existing = cloud.get_article(data_ctx.cloud, article_id) if data_ctx.is_cloud else db.get_article(article_id)
    if not existing:
        api_error(status_code=404, code="article_not_found", message="Article not found.", request=request)
    if data_ctx.is_cloud:
        cloud.delete_article(data_ctx.cloud, article_id)
    else:
        db.delete_article(article_id)
    log_domain_event("article.delete", request=request, meta={"article_id": article_id})
    return api_ok(request)
