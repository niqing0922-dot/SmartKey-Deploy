import json
import os
import sqlite3
import threading
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, Request

REPO_ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = Path(os.getenv("SMARTKEY_LOG_DIR") or REPO_ROOT / ".artifacts" / "logs")
BACKEND_LOG_PATH = LOG_DIR / "backend.jsonl"
FRONTEND_LOG_PATH = LOG_DIR / "frontend-events.jsonl"
LOG_DIR.mkdir(parents=True, exist_ok=True)

_log_lock = threading.Lock()
_recent_errors: deque[dict[str, Any]] = deque(maxlen=25)
_recent_events: deque[dict[str, Any]] = deque(maxlen=100)
_request_metrics: dict[str, dict[str, Any]] = {}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_request_id() -> str:
    return f"req_{uuid4().hex[:16]}"


def get_request_id(request: Request | None) -> str:
    if request is None:
        return build_request_id()
    request_id = getattr(request.state, "request_id", "")
    return request_id or build_request_id()


def _write_jsonl(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with _log_lock:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def log_entry(
    *,
    level: str,
    event: str,
    request_id: str | None = None,
    route: str | None = None,
    method: str | None = None,
    status_code: int | None = None,
    duration_ms: int | None = None,
    error_code: str | None = None,
    meta: dict[str, Any] | None = None,
    frontend: bool = False,
) -> dict[str, Any]:
    payload = {
        "timestamp": now_iso(),
        "level": level,
        "event": event,
        "request_id": request_id or "",
        "route": route or "",
        "method": method or "",
        "status_code": status_code,
        "duration_ms": duration_ms,
        "error_code": error_code or "",
        "meta": meta or {},
    }
    _recent_events.appendleft(payload)
    _write_jsonl(FRONTEND_LOG_PATH if frontend else BACKEND_LOG_PATH, payload)
    return payload


def log_request(
    *,
    request: Request,
    status_code: int,
    duration_ms: int,
    error_code: str | None = None,
    client: str | None = None,
) -> None:
    route = request.url.path
    bucket = _request_metrics.setdefault(
        route,
        {"count": 0, "errors": 0, "durations": deque(maxlen=200), "method": request.method},
    )
    bucket["count"] += 1
    bucket["durations"].append(duration_ms)
    if status_code >= 400:
        bucket["errors"] += 1
    payload = log_entry(
        level="error" if status_code >= 500 else "info",
        event="http.request",
        request_id=get_request_id(request),
        route=route,
        method=request.method,
        status_code=status_code,
        duration_ms=duration_ms,
        error_code=error_code,
        meta={"client": client or ""},
    )
    if status_code >= 400:
        _recent_errors.appendleft(payload)


def log_domain_event(
    event: str,
    *,
    request: Request | None = None,
    level: str = "info",
    status_code: int | None = None,
    error_code: str | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    payload = log_entry(
        level=level,
        event=event,
        request_id=get_request_id(request),
        route=request.url.path if request else None,
        method=request.method if request else None,
        status_code=status_code,
        error_code=error_code,
        meta=meta,
    )
    if level == "error" or (status_code is not None and status_code >= 400):
        _recent_errors.appendleft(payload)


def api_ok(request: Request | None = None, status: str = "ok", **payload: Any) -> dict[str, Any]:
    data = {"status": status, "request_id": get_request_id(request)}
    data.update(payload)
    return data


def api_error(
    *,
    status_code: int,
    code: str,
    message: str,
    request: Request | None = None,
    details: dict[str, Any] | None = None,
    kind: str = "user_actionable",
) -> HTTPException:
    raise HTTPException(
        status_code=status_code,
        detail={
            "code": code,
            "message": message,
            "details": details or {},
            "kind": kind,
            "request_id": get_request_id(request),
        },
    )


def readiness_snapshot(*, db_path: Path, frontend_dist: Path) -> dict[str, Any]:
    checks: dict[str, dict[str, Any]] = {
        "sqlite": {"ok": False, "details": str(db_path)},
        "frontend_dist": {"ok": frontend_dist.exists(), "details": str(frontend_dist)},
        "log_dir": {"ok": LOG_DIR.exists(), "details": str(LOG_DIR)},
    }
    try:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(db_path)
        conn.execute("SELECT 1")
        conn.close()
        checks["sqlite"]["ok"] = True
    except Exception as exc:
        checks["sqlite"]["details"] = str(exc)
    overall = all(item["ok"] for item in checks.values())
    return {"status": "ok" if overall else "degraded", "checks": checks}


def metrics_snapshot() -> dict[str, Any]:
    routes: list[dict[str, Any]] = []
    for route, data in sorted(_request_metrics.items()):
        durations = list(data["durations"])
        routes.append(
            {
                "route": route,
                "method": data["method"],
                "count": data["count"],
                "errors": data["errors"],
                "avg_duration_ms": round(mean(durations), 2) if durations else 0,
                "max_duration_ms": max(durations) if durations else 0,
            }
        )
    return {"routes": routes}


def diagnostics_snapshot(*, app_version: str, db_path: Path, frontend_dist: Path) -> dict[str, Any]:
    return {
        "version": app_version,
        "database_path": str(db_path),
        "frontend_dist": str(frontend_dist),
        "log_dir": str(LOG_DIR),
        "backend_log_path": str(BACKEND_LOG_PATH),
        "frontend_event_log_path": str(FRONTEND_LOG_PATH),
        "readiness": readiness_snapshot(db_path=db_path, frontend_dist=frontend_dist),
        "metrics": metrics_snapshot(),
        "recent_errors": list(_recent_errors),
        "recent_events": list(_recent_events)[:20],
    }
