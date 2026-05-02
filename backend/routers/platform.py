from fastapi import APIRouter, Request

from backend.observability import api_ok
from backend.services.model_routing import model_routing_snapshot

router = APIRouter(prefix="/api/platform", tags=["platform"])


@router.get("/status")
def get_platform_status(request: Request):
    workspace_id = (request.headers.get("x-workspace-id") or "").strip()
    return api_ok(request, platform=model_routing_snapshot(workspace_id=workspace_id))
