from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel

from backend.observability import api_ok, log_domain_event
from backend.services.local_data_service import (
    create_backup_file,
    export_data_snapshot,
    get_summary,
    import_data_snapshot,
    list_backup_items,
    reset_data as reset_local_data_service,
)

legacy_db_router = APIRouter(prefix="/api/db", tags=["db"])
router = APIRouter(prefix="/api/local-data", tags=["local-data"])


class SnapshotPayload(BaseModel):
    snapshot: dict[str, Any]


class ResetPayload(BaseModel):
    mode: str = "content"


@legacy_db_router.get("/export")
def export_data(request: Request):
    return api_ok(request, snapshot=export_data_snapshot())


@legacy_db_router.post("/import")
def import_data(payload: SnapshotPayload, request: Request):
    import_data_snapshot(payload.snapshot)
    log_domain_event("local.import", request=request)
    return api_ok(request)


@router.get("/summary")
def get_local_summary(request: Request):
    return api_ok(request, summary=get_summary())


@router.get("/export")
def export_local_data(request: Request):
    return api_ok(request, snapshot=export_data_snapshot())


@router.get("/backups")
def get_backups(request: Request):
    return api_ok(request, items=list_backup_items())


@router.post("/backup")
def create_local_backup(request: Request):
    path = create_backup_file()
    log_domain_event("backup.create", request=request, meta={"path": path})
    return api_ok(request, path=path)


@router.post("/import")
def import_local_data(payload: SnapshotPayload, request: Request):
    import_data_snapshot(payload.snapshot)
    log_domain_event("local.import", request=request)
    return api_ok(request)


@router.post("/reset")
def reset_data(payload: ResetPayload, request: Request):
    reset_local_data_service(payload.mode)
    log_domain_event("local.reset", request=request, meta={"mode": payload.mode})
    return api_ok(request, mode=payload.mode)
