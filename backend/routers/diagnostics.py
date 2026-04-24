from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from backend.db import DB_PATH
from backend.observability import api_ok, diagnostics_snapshot, log_entry, readiness_snapshot

router = APIRouter(prefix="/api", tags=["diagnostics"])


class FrontendEventPayload(BaseModel):
    level: str = "info"
    event: str = "frontend.event"
    route: str = ""
    details: dict[str, Any] = Field(default_factory=dict)
    duration_ms: int | None = None


@router.get("/health/readiness")
def get_readiness(request: Request):
    snapshot = readiness_snapshot(db_path=DB_PATH, frontend_dist=request.app.state.frontend_dist)
    return api_ok(request, readiness=snapshot)


@router.get("/diagnostics/runtime")
def get_runtime_diagnostics(request: Request):
    return api_ok(
        request,
        runtime=diagnostics_snapshot(
            app_version=str(request.app.state.app_version),
            db_path=DB_PATH,
            frontend_dist=request.app.state.frontend_dist,
        ),
    )


@router.post("/diagnostics/frontend-event")
def post_frontend_event(payload: FrontendEventPayload, request: Request):
    log_entry(
        level=payload.level,
        event=payload.event,
        request_id=request.headers.get("x-request-id") or "",
        route=payload.route,
        duration_ms=payload.duration_ms,
        meta=payload.details,
        frontend=True,
    )
    return api_ok(request)
