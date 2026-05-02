from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.config import get_app_settings
from backend.observability import api_error, api_ok, log_domain_event
from backend.repositories.rank import create_rank_job, get_rank_job, list_rank_jobs, list_rank_results
from backend.services.model_routing import platform_capabilities
from backend.services.rank_workbench import preview_rank_template, run_batch_template_tracking, run_single_keyword_tracking

router = APIRouter(prefix="/api/rank", tags=["rank"])
APP_SETTINGS = get_app_settings()
DEFAULT_RANK_TARGET_DOMAIN = "waveteliot.com"
DEFAULT_PROVIDER = "serpapi"


class RankTemplateFile(BaseModel):
    filename: str
    content_base64: str


class RankTemplatePreviewPayload(BaseModel):
    file: RankTemplateFile


class RankRunPayload(BaseModel):
    mode: Literal["batch_template_run", "single_keyword_check"] = "batch_template_run"
    template_file: RankTemplateFile | None = None
    keywords: list[str] = Field(default_factory=list)
    domain: str = ""
    provider: str = DEFAULT_PROVIDER
    max_pages: int = 10
    results_per_request: int = 100
    hl: str = "en"
    gl: str = ""
    source: str = "manual"
    date_column_label: str = ""


def _platform_rank_ready() -> bool:
    return bool(platform_capabilities()["rank_available"])


def _require_rank_ready(request: Request) -> None:
    if not _platform_rank_ready():
        api_error(
            status_code=503,
            code="platform_unavailable",
            message="Rank tracking is not available for this workspace right now.",
            request=request,
            details={"provider": DEFAULT_PROVIDER},
        )


def _platform_domain(domain: str = "") -> str:
    return domain.strip() or APP_SETTINGS.rank_target_domain.strip() or DEFAULT_RANK_TARGET_DOMAIN


@router.get("/jobs")
def get_rank_jobs(request: Request):
    jobs = list_rank_jobs(20)
    if not _platform_rank_ready():
        return api_ok(
            request,
            status="platform_unavailable",
            items=jobs,
            message="Rank tracking is managed by the platform and is not enabled for this workspace yet.",
            default_domain=_platform_domain(),
        )
    return api_ok(request, status="ready", items=jobs, default_domain=_platform_domain())


@router.post("/template/preview")
def get_rank_template_preview(payload: RankTemplatePreviewPayload, request: Request):
    try:
        preview = preview_rank_template(payload.file.filename, payload.file.content_base64)
        return api_ok(request, preview=preview)
    except Exception as exc:
        api_error(status_code=400, code="invalid_input", message=str(exc), request=request)


@router.get("/jobs/{job_id}/results")
def get_rank_job_results(job_id: str, request: Request):
    job = get_rank_job(job_id)
    if not job:
        api_error(status_code=404, code="not_found", message="Rank job not found.", request=request)
    return api_ok(request, item=job, items=list_rank_results(job_id), summary=job.get("summary", {}), params=job.get("params", {}))


@router.get("/jobs/{job_id}/artifacts/{artifact_kind}")
def download_rank_job_artifact(job_id: str, artifact_kind: Literal["xlsx", "csv"], request: Request):
    job = get_rank_job(job_id)
    if not job:
        api_error(status_code=404, code="not_found", message="Rank job not found.", request=request)
    summary = job.get("summary", {})
    file_path = summary.get("output_file") if artifact_kind == "xlsx" else summary.get("detail_file")
    if not file_path:
        api_error(status_code=404, code="not_found", message="Requested artifact is not available for this job.", request=request)
    artifact = Path(str(file_path))
    if not artifact.exists():
        api_error(status_code=404, code="not_found", message="Artifact file is missing on disk.", request=request)
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if artifact_kind == "xlsx" else "text/csv"
    return FileResponse(artifact, filename=artifact.name, media_type=media_type)


@router.post("/jobs/run")
def run_rank_job(payload: RankRunPayload, request: Request):
    _require_rank_ready(request)
    domain = _platform_domain(payload.domain)
    if not domain:
        api_error(status_code=400, code="invalid_input", message="Target domain is required for rank tracking.", request=request)

    try:
        if payload.mode == "batch_template_run":
            if not payload.template_file:
                api_error(status_code=400, code="invalid_input", message="A template file is required for batch template runs.", request=request)
            log_domain_event("adapter.rank.template_run", request=request, meta={"provider": DEFAULT_PROVIDER, "domain": domain})
            runner_result = run_batch_template_tracking(
                filename=payload.template_file.filename,
                content_base64=payload.template_file.content_base64,
                domain=domain,
                provider_name=DEFAULT_PROVIDER,
                max_pages=max(1, int(payload.max_pages)),
                results_per_request=max(10, int(payload.results_per_request)),
                hl=payload.hl.strip() or "en",
                gl=payload.gl.strip(),
                api_key=APP_SETTINGS.rank_provider_key,
                date_column_label=payload.date_column_label,
            )
            job_payload = {
                "mode": payload.mode,
                "domain": domain,
                "provider": DEFAULT_PROVIDER,
                "source": payload.source.strip() or "manual",
                "template_file_name": payload.template_file.filename,
                "hl": payload.hl.strip() or "en",
                "gl": payload.gl.strip(),
                "maxPages": max(1, int(payload.max_pages)),
                "resultsPerRequest": max(10, int(payload.results_per_request)),
                "dateColumnLabel": payload.date_column_label.strip(),
            }
            job = create_rank_job(job_payload, runner_result)
            return api_ok(
                request,
                status="completed",
                mode=payload.mode,
                job=job,
                job_id=job["id"],
                results=runner_result.get("results", []),
                summary=runner_result.get("summary", {}),
                columns=runner_result.get("columns", []),
                rows=runner_result.get("rows", []),
                template_preview=runner_result.get("template_preview", {}),
                output_file=runner_result.get("output_file"),
                detail_file=runner_result.get("detail_file"),
            )

        keyword = next((item.strip() for item in payload.keywords if item and item.strip()), "")
        if not keyword:
            api_error(status_code=400, code="invalid_input", message="A keyword is required for single keyword checks.", request=request)
        log_domain_event("adapter.rank.single_run", request=request, meta={"provider": DEFAULT_PROVIDER, "domain": domain})
        runner_result = run_single_keyword_tracking(
            keyword=keyword,
            domain=domain,
            provider_name=DEFAULT_PROVIDER,
            max_pages=max(1, int(payload.max_pages)),
            results_per_request=max(10, int(payload.results_per_request)),
            hl=payload.hl.strip() or "en",
            gl=payload.gl.strip(),
            api_key=APP_SETTINGS.rank_provider_key,
        )
        job_payload = {
            "mode": payload.mode,
            "domain": domain,
            "provider": DEFAULT_PROVIDER,
            "source": payload.source.strip() or "manual",
            "keywords": [keyword],
            "hl": payload.hl.strip() or "en",
            "gl": payload.gl.strip(),
            "maxPages": max(1, int(payload.max_pages)),
            "resultsPerRequest": max(10, int(payload.results_per_request)),
        }
        job = create_rank_job(job_payload, runner_result)
        return api_ok(request, status="completed", mode=payload.mode, job=job, job_id=job["id"], results=runner_result.get("results", []), summary=runner_result.get("summary", {}))
    except Exception as exc:
        api_error(status_code=500, code="system_failure", message=str(exc), request=request, kind="system_failure")
