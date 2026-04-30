from fastapi import APIRouter, Request
from pydantic import BaseModel

from backend.auth import require_cloud_context, require_cloud_user
from backend.observability import api_ok, log_domain_event
from backend.repositories.cloud import ensure_profile_and_default_workspace, import_snapshot, list_workspaces

router = APIRouter(prefix="/api/cloud", tags=["cloud"])


class CloudImportPayload(BaseModel):
    snapshot: dict


@router.get("/bootstrap")
def bootstrap_cloud_workspace(request: Request):
    user = require_cloud_user(request)
    default_workspace = ensure_profile_and_default_workspace(user)
    workspaces = list_workspaces(user)
    return api_ok(request, user={"id": user.user_id, "email": user.email}, workspace=default_workspace, workspaces=workspaces)


@router.get("/workspaces")
def get_workspaces(request: Request):
    user = require_cloud_user(request)
    return api_ok(request, items=list_workspaces(user))


@router.post("/import")
def import_cloud_snapshot(payload: CloudImportPayload, request: Request):
    ctx = require_cloud_context(request)
    result = import_snapshot(ctx, payload.snapshot)
    log_domain_event("cloud.import", request=request, meta={"workspace_id": ctx.workspace_id, "result": result["imported"]})
    return api_ok(request, result=result)
