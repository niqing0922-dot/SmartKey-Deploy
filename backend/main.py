from pathlib import Path
from time import perf_counter

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.config import get_app_settings
from backend.db import DB_PATH, init_db
from backend.observability import api_ok, build_request_id, diagnostics_snapshot, log_domain_event, log_request
from backend.routers.ai import router as ai_router
from backend.routers.articles import router as articles_router
from backend.routers.auth_proxy import router as auth_proxy_router
from backend.routers.cloud import router as cloud_router
from backend.routers.dashboard import router as dashboard_router
from backend.routers.diagnostics import router as diagnostics_router
from backend.routers.downloads import router as downloads_router
from backend.routers.geo_writer import router as geo_writer_router
from backend.routers.indexing import router as indexing_router
from backend.routers.keywords import router as keywords_router
from backend.routers.local_data import legacy_db_router, router as local_data_router
from backend.routers.platform import router as platform_router
from backend.routers.rank import router as rank_router
from backend.routers.settings import router as settings_router
from backend.routers.workbench import router as workbench_router

init_db()
settings = get_app_settings()

app = FastAPI(title="SmartKey API")
app.state.app_version = settings.app_version
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


def register_routers(api: FastAPI) -> None:
    core_routers = (
        dashboard_router,
        keywords_router,
        articles_router,
        legacy_db_router,
        local_data_router,
        settings_router,
        geo_writer_router,
        workbench_router,
    )
    optional_integration_routers = (
        ai_router,
        rank_router,
        indexing_router,
    )
    system_routers = (
        auth_proxy_router,
        cloud_router,
        diagnostics_router,
        downloads_router,
        platform_router,
    )

    for router in (*core_routers, *optional_integration_routers, *system_routers):
        api.include_router(router)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or build_request_id()
    request.state.request_id = request_id
    started = perf_counter()
    response = await call_next(request)
    duration_ms = int((perf_counter() - started) * 1000)
    response.headers["x-request-id"] = request_id
    error_code = response.headers.get("x-error-code")
    client = request.client.host if request.client else ""
    log_request(request=request, status_code=response.status_code, duration_ms=duration_ms, error_code=error_code, client=client)
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
    payload = {
        "code": detail.get("code", "http_error"),
        "message": detail.get("message", "Request failed"),
        "details": detail.get("details", {}),
        "kind": detail.get("kind", "user_actionable" if exc.status_code < 500 else "system_failure"),
        "request_id": detail.get("request_id") or request.state.request_id,
    }
    log_domain_event(
        "http.exception",
        request=request,
        level="error" if exc.status_code >= 500 else "info",
        status_code=exc.status_code,
        error_code=payload["code"],
        meta={"message": payload["message"]},
    )
    response = JSONResponse(status_code=exc.status_code, content={"error": payload})
    response.headers["x-request-id"] = payload["request_id"]
    response.headers["x-error-code"] = payload["code"]
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    payload = {
        "code": "validation_error",
        "message": "Request validation failed.",
        "details": {"errors": exc.errors()},
        "kind": "user_actionable",
        "request_id": request.state.request_id,
    }
    response = JSONResponse(status_code=422, content={"error": payload})
    response.headers["x-request-id"] = payload["request_id"]
    response.headers["x-error-code"] = payload["code"]
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    payload = {
        "code": "system_failure",
        "message": "Unexpected server error.",
        "details": {},
        "kind": "system_failure",
        "request_id": request.state.request_id,
    }
    log_domain_event(
        "http.unhandled_exception",
        request=request,
        level="error",
        status_code=500,
        error_code=payload["code"],
        meta={"message": str(exc)},
    )
    response = JSONResponse(status_code=500, content={"error": payload})
    response.headers["x-request-id"] = payload["request_id"]
    response.headers["x-error-code"] = payload["code"]
    return response


register_routers(app)


@app.get("/health")
@app.get("/api/health")
def health(request: Request):
    return api_ok(request)


frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
app.state.frontend_dist = frontend_dist
assets_dir = frontend_dist / "assets"
if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/{full_path:path}")
def frontend(full_path: str):
    target = frontend_dist / full_path
    if full_path and target.exists() and target.is_file():
        return FileResponse(target)
    index_path = frontend_dist / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return diagnostics_snapshot(app_version=str(app.state.app_version), db_path=DB_PATH, frontend_dist=frontend_dist)
