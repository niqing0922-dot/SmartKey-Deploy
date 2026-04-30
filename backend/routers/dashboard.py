from fastapi import APIRouter, Request

from backend.auth import require_cloud_context
from backend.observability import api_ok
from backend.repositories.cloud import dashboard_stats

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_dashboard_stats(request: Request):
    ctx = require_cloud_context(request)
    return api_ok(request, stats=dashboard_stats(ctx))
