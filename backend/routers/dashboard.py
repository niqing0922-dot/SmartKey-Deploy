from fastapi import APIRouter, Request

from backend.db import dashboard_stats
from backend.observability import api_ok

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_dashboard_stats(request: Request):
    return api_ok(request, stats=dashboard_stats())
