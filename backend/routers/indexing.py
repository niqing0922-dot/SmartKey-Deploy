import json
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.config import get_app_settings
from backend.observability import api_error, api_ok, log_domain_event
from backend.repositories.indexing import create_indexing_job, list_indexing_jobs, list_indexing_pages
from backend.repositories.settings import get_runtime_settings
from backend.services.indexing_prepare import prepare_search_console_export

router = APIRouter(prefix="/api/indexing", tags=["indexing"])
APP_SETTINGS = get_app_settings()

REPO_ROOT = Path(__file__).resolve().parents[2]
INDEXING_RUNNER_PATH = REPO_ROOT / "backend" / "python" / "run_indexing_job.py"


class IndexingRunPayload(BaseModel):
    action: str = "inspect"
    site_url: str = ""
    urls: list[str] = Field(default_factory=list)
    url_file_path: str = ""
    max_pages: int = 50
    crawl_delay: float = 0.5
    check_delay: float = 0.3
    credentials_path: str = ""
    submission_type: str = "URL_UPDATED"
    max_retries: int = 3


class IndexingPrepareSource(BaseModel):
    filename: str
    content: str


class IndexingPreparePayload(BaseModel):
    sources: list[IndexingPrepareSource] = Field(default_factory=list)


def normalize_site_url(value: str) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    candidate = text if "://" in text else f"https://{text}"
    parsed = urlparse(candidate)
    host = (parsed.netloc or "").strip().lower()
    if not host:
        return ""
    return f"{parsed.scheme or 'https'}://{host}"


def dedupe_urls(urls: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for raw in urls:
        url = (raw or "").strip()
        if not url:
            continue
        if url in seen:
            continue
        seen.add(url)
        output.append(url)
    return output


@router.post("/prepare")
def prepare_indexing_sources(payload: IndexingPreparePayload, request: Request):
    if not payload.sources:
        api_error(status_code=400, code="invalid_input", message="Please upload at least one source file.", request=request)
    try:
        result = prepare_search_console_export([item.model_dump() for item in payload.sources])
        log_domain_event(
            "adapter.indexing.prepare",
            request=request,
            meta={
                "source_count": len(payload.sources),
                "submit_ready": result["counts"]["submit_ready"],
                "excluded": result["counts"]["excluded"],
            },
        )
        return api_ok(request, status="prepared", **result)
    except HTTPException:
        raise
    except Exception as exc:
        api_error(status_code=400, code="invalid_input", message=str(exc), request=request)


def run_indexing_runner(payload: dict[str, Any], python_command: str) -> dict[str, Any]:
    completed = subprocess.run(
        [python_command, str(INDEXING_RUNNER_PATH)],
        input=json.dumps(payload, ensure_ascii=False),
        text=True,
        cwd=str(REPO_ROOT),
        capture_output=True,
        timeout=APP_SETTINGS.indexing_runner_timeout_seconds,
    )
    if completed.returncode != 0:
        raise RuntimeError((completed.stderr or completed.stdout or "Indexing runner failed").strip())
    try:
        return json.loads((completed.stdout or "{}").strip() or "{}")
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Failed to parse indexing runner output: {exc}") from exc


@router.get("/jobs")
def get_indexing_jobs(request: Request):
    settings = get_runtime_settings()
    jobs = list_indexing_jobs(20)
    credentials_path = str(settings.get("google_credentials_path") or "").strip()
    credentials_ready = bool(credentials_path) and Path(credentials_path).exists() and bool(settings.get("indexing_enabled"))
    if not credentials_ready:
        return api_ok(request, status="configuration_required", items=jobs, message="Indexing requires enabled Google credentials in Settings.")
    return api_ok(request, status="ready", items=jobs)


@router.get("/jobs/{job_id}/pages")
def get_indexing_job_pages(job_id: str, request: Request):
    return api_ok(request, items=list_indexing_pages(job_id))


@router.post("/jobs/run")
def run_indexing_job(payload: IndexingRunPayload, request: Request):
    settings = get_runtime_settings()
    python_command = (settings.get("python_path") or "").strip() or sys.executable
    credentials_path = (
        payload.credentials_path.strip()
        or (settings.get("google_credentials_path") or "").strip()
    )
    if not credentials_path:
        api_error(status_code=400, code="configuration_required", message="Google credentials path is not configured in Settings.", request=request)
    if not settings.get("indexing_enabled"):
        api_error(status_code=400, code="configuration_required", message="Indexing is disabled in Settings.", request=request)
    if not Path(credentials_path).exists():
        api_error(status_code=400, code="configuration_required", message="Google credentials file does not exist.", request=request)

    action = (payload.action or "inspect").strip().lower()
    if action not in {"inspect", "submit"}:
        api_error(status_code=400, code="invalid_input", message="Unsupported indexing action.", request=request)

    raw_site_url = payload.site_url.strip()
    raw_urls = dedupe_urls([item.strip() for item in payload.urls if item and item.strip()])
    raw_url_file_path = payload.url_file_path.strip()

    if not raw_site_url and not raw_urls and not raw_url_file_path:
        api_error(status_code=400, code="invalid_input", message="Please provide site_url, urls, or url_file_path.", request=request)

    site_url = normalize_site_url(raw_site_url)
    if action == "inspect" and not site_url and raw_urls:
        parsed = urlparse(raw_urls[0] if "://" in raw_urls[0] else f"https://{raw_urls[0]}")
        if parsed.netloc:
            site_url = f"{parsed.scheme or 'https'}://{parsed.netloc.lower()}"

    runner_payload = {
        "action": action,
        "siteUrl": site_url,
        "urls": raw_urls,
        "urlFilePath": raw_url_file_path,
        "maxPages": max(1, int(payload.max_pages)),
        "crawlDelay": max(0.0, float(payload.crawl_delay)),
        "checkDelay": max(0.0, float(payload.check_delay)),
        "credentialsPath": credentials_path,
        "indexingKeyFile": credentials_path,
        "submissionType": payload.submission_type.strip().upper() or "URL_UPDATED",
        "maxRetries": max(1, int(payload.max_retries)),
    }

    if action == "inspect" and not runner_payload["siteUrl"]:
        api_error(status_code=400, code="invalid_input", message="Inspect requires site_url or at least one URL to infer domain.", request=request)
    if action == "submit" and not runner_payload["urls"] and not runner_payload["urlFilePath"]:
        api_error(status_code=400, code="invalid_input", message="urls is required for submit action, or provide url_file_path.", request=request)

    try:
        log_domain_event("adapter.indexing.run", request=request, meta={"action": action, "url_count": len(raw_urls)})
        runner_result = run_indexing_runner(runner_payload, python_command)
        job = create_indexing_job(runner_payload, runner_result)
        return api_ok(
            request,
            status="completed",
            job={
                "id": job["id"],
                "summary": runner_result.get("summary", {}),
                "started_at": runner_result.get("started_at"),
                "finished_at": runner_result.get("finished_at"),
            },
            pages=runner_result.get("pages", []),
            job_id=job["id"],
            summary=runner_result.get("summary", {}),
            started_at=runner_result.get("started_at"),
            finished_at=runner_result.get("finished_at"),
        )
    except subprocess.TimeoutExpired as exc:
        api_error(status_code=504, code="adapter_timeout", message=f"Indexing job timed out: {exc}", request=request, kind="system_failure")
    except FileNotFoundError:
        api_error(status_code=400, code="configuration_required", message=f"Python executable not found: {python_command}", request=request)
    except HTTPException:
        raise
    except Exception as exc:
        api_error(status_code=500, code="system_failure", message=str(exc), request=request, kind="system_failure")
