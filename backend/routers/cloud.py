from fastapi import APIRouter, Request
from pydantic import BaseModel

from backend.auth import require_cloud_context, require_cloud_user
from backend.observability import api_ok, log_domain_event
from backend.repositories.cloud import bootstrap_workspace_state, import_snapshot

router = APIRouter(prefix="/api/cloud", tags=["cloud"])


class CloudImportPayload(BaseModel):
    snapshot: dict


@router.get("/bootstrap")
def bootstrap_cloud_workspace(request: Request):
    user = require_cloud_user(request)
    preferred_workspace_id = (request.headers.get("x-workspace-id") or request.query_params.get("workspace_id") or "").strip()
    payload = bootstrap_workspace_state(user, preferred_workspace_id)
    return api_ok(request, **payload)


@router.get("/workspaces")
def get_workspaces(request: Request):
    user = require_cloud_user(request)
    payload = bootstrap_workspace_state(user)
    return api_ok(request, items=payload["workspaces"])


@router.post("/import")
def import_cloud_snapshot(payload: CloudImportPayload, request: Request):
    ctx = require_cloud_context(request)
    result = import_snapshot(ctx, payload.snapshot)
    log_domain_event("cloud.import", request=request, meta={"workspace_id": ctx.workspace_id, "result": result["imported"]})
    return api_ok(request, result=result)
