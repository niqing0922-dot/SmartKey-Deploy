from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from backend.auth import require_cloud_context
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
    ctx = require_cloud_context(request)
    return api_ok(request, items=cloud.list_articles(ctx))


@router.post("/articles")
def post_article(payload: ArticlePayload, request: Request):
    ctx = require_cloud_context(request)
    item = cloud.create_article(ctx, payload.model_dump())
    log_domain_event("article.create", request=request, meta={"article_id": item["id"]})
    return api_ok(request, item=item)


@router.put("/articles/{article_id}")
def put_article(article_id: str, payload: ArticlePayload, request: Request):
    ctx = require_cloud_context(request)
    item = cloud.update_article(ctx, article_id, payload.model_dump())
    if not item:
        api_error(status_code=404, code="article_not_found", message="Article not found.", request=request)
    log_domain_event("article.update", request=request, meta={"article_id": article_id})
    return api_ok(request, item=item)


@router.delete("/articles/{article_id}")
def remove_article(article_id: str, request: Request):
    ctx = require_cloud_context(request)
    if not cloud.get_article(ctx, article_id):
        api_error(status_code=404, code="article_not_found", message="Article not found.", request=request)
    cloud.delete_article(ctx, article_id)
    log_domain_event("article.delete", request=request, meta={"article_id": article_id})
    return api_ok(request)
