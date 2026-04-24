import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.db import (
    create_rank_job,
    get_settings,
    list_keywords,
    list_rank_jobs,
    list_rank_results,
)
from backend.observability import api_error, api_ok, log_domain_event

router = APIRouter(prefix="/api/rank", tags=["rank"])

REPO_ROOT = Path(__file__).resolve().parents[2]
RANK_RUNNER_PATH = REPO_ROOT / "backend" / "python" / "run_rank_job.py"


class RankRunPayload(BaseModel):
    keywords: list[str] = Field(default_factory=list)
    domain: str = ""
    provider: str = "serpapi"
    max_pages: int = 10
    results_per_request: int = 100
    hl: str = "en"
    gl: str = ""
    reserve_credits: int = 10
    source: str = "manual"


def run_rank_runner(payload: dict[str, Any], python_command: str, env: dict[str, str]) -> dict[str, Any]:
    completed = subprocess.run(
        [python_command, str(RANK_RUNNER_PATH)],
        input=json.dumps(payload, ensure_ascii=False),
        text=True,
        cwd=str(REPO_ROOT),
        capture_output=True,
        env=env,
        timeout=600,
    )
    if completed.returncode != 0:
        raise RuntimeError((completed.stderr or completed.stdout or "Rank runner failed").strip())
    try:
        return json.loads((completed.stdout or "{}").strip() or "{}")
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Failed to parse rank runner output: {exc}") from exc


@router.get("/jobs")
def get_rank_jobs(request: Request):
    settings = get_settings()
    jobs = list_rank_jobs(20)
    if not settings.get("serpapi_key") or not settings.get("serpapi_enabled"):
        return api_ok(request, status="configuration_required", items=jobs, message="Ranking requires enabled SerpAPI credentials in Settings.")
    if not settings.get("rank_target_domain"):
        return api_ok(request, status="configuration_required", items=jobs, message="Ranking requires a default target domain in Settings.")
    return api_ok(request, status="ready", items=jobs)


@router.get("/jobs/{job_id}/results")
def get_rank_job_results(job_id: str, request: Request):
    return api_ok(request, items=list_rank_results(job_id))


@router.post("/jobs/run")
def run_rank_job(payload: RankRunPayload, request: Request):
    settings = get_settings()
    python_command = (settings.get("python_path") or "").strip() or sys.executable

    provider = payload.provider.lower().strip() or "serpapi"
    if provider == "serpapi" and (not settings.get("serpapi_key") or not settings.get("serpapi_enabled")):
        api_error(
            status_code=400,
            code="configuration_required",
            message="SerpAPI key is not configured or enabled in Settings.",
            request=request,
            details={"provider": provider},
        )

    keyword_list = [item.strip() for item in payload.keywords if item and item.strip()]
    if not keyword_list:
        keyword_list = [item["keyword"] for item in list_keywords() if item.get("keyword")]
    if not keyword_list:
        api_error(status_code=400, code="invalid_input", message="At least one keyword is required.", request=request)

    domain = payload.domain.strip() or str(settings.get("rank_target_domain") or "").strip()
    if not domain:
        api_error(
            status_code=400,
            code="configuration_required",
            message="Target domain is required. Set rank_target_domain in Settings.",
            request=request,
        )

    runner_payload = {
        "keywords": keyword_list,
        "domain": domain,
        "provider": provider,
        "maxPages": max(1, int(payload.max_pages)),
        "resultsPerRequest": max(10, int(payload.results_per_request)),
        "hl": payload.hl.strip() or "en",
        "gl": payload.gl.strip(),
        "reserveCredits": max(0, int(payload.reserve_credits)),
        "source": payload.source.strip() or "manual",
    }

    env = {
        **os.environ,
        "PYTHONIOENCODING": "utf-8",
    }
    if settings.get("serpapi_key"):
        env["SERPAPI_API_KEY"] = settings["serpapi_key"]

    try:
        log_domain_event("adapter.rank.run", request=request, meta={"provider": provider, "keyword_count": len(keyword_list)})
        runner_result = run_rank_runner(runner_payload, python_command, env)
        job = create_rank_job(runner_payload, runner_result)
        return api_ok(
            request,
            status="completed",
            job={
                "id": job["id"],
                "summary": runner_result.get("summary", {}),
                "started_at": runner_result.get("started_at"),
                "finished_at": runner_result.get("finished_at"),
            },
            results=runner_result.get("results", []),
            job_id=job["id"],
            summary=runner_result.get("summary", {}),
            started_at=runner_result.get("started_at"),
            finished_at=runner_result.get("finished_at"),
        )
    except subprocess.TimeoutExpired as exc:
        api_error(status_code=504, code="adapter_timeout", message=f"Rank job timed out: {exc}", request=request, kind="system_failure")
    except FileNotFoundError:
        api_error(status_code=400, code="configuration_required", message=f"Python executable not found: {python_command}", request=request)
    except HTTPException:
        raise
    except Exception as exc:
        api_error(status_code=500, code="system_failure", message=str(exc), request=request, kind="system_failure")
