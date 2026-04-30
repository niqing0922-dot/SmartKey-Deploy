from fastapi import APIRouter, Request

from backend import db
from backend.data_context import get_data_context
from backend.observability import api_ok
from backend.repositories import cloud

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_dashboard_stats(request: Request):
    data_ctx = get_data_context(request)
    stats = cloud.dashboard_stats(data_ctx.cloud) if data_ctx.is_cloud else db.dashboard_stats()
    return api_ok(request, stats=stats)
