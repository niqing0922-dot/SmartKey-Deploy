from typing import Any

from backend.db import _dumps, _loads, connect, make_id, now_iso


def create_rank_job(payload: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    timestamp = now_iso()
    record = {
        "id": make_id(),
        "domain": payload.get("domain", ""),
        "provider": payload.get("provider", "serpapi"),
        "source": payload.get("source", "manual"),
        "status": "completed",
        "params_json": _dumps(payload),
        "summary_json": _dumps(result.get("summary", {})),
        "started_at": result.get("started_at") or timestamp,
        "finished_at": result.get("finished_at") or timestamp,
        "created_at": timestamp,
    }
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO rank_jobs (id, domain, provider, source, status, params_json, summary_json, started_at, finished_at, created_at)
            VALUES (:id, :domain, :provider, :source, :status, :params_json, :summary_json, :started_at, :finished_at, :created_at)
            """,
            record,
        )
        for item in result.get("results", []) or []:
            conn.execute(
                """
                INSERT INTO rank_results (id, job_id, keyword, found, page, position, url, provider, error, queried_at, raw_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    make_id(),
                    record["id"],
                    str(item.get("keyword", "")),
                    1 if bool(item.get("found")) else 0,
                    item.get("page"),
                    item.get("position"),
                    str(item.get("url", "") or ""),
                    str(item.get("provider", "") or ""),
                    str(item.get("error", "") or ""),
                    str(item.get("queried_at", "") or ""),
                    _dumps(item),
                    timestamp,
                ),
            )
    return {
        "id": record["id"],
        "domain": record["domain"],
        "provider": record["provider"],
        "source": record["source"],
        "status": record["status"],
        "summary": _loads(record["summary_json"], {}),
        "started_at": record["started_at"],
        "finished_at": record["finished_at"],
        "created_at": record["created_at"],
    }


def list_rank_jobs(limit: int = 20) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM rank_jobs ORDER BY created_at DESC LIMIT ?",
            (max(1, int(limit)),),
        ).fetchall()
    jobs: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        jobs.append(
            {
                "id": item["id"],
                "domain": item["domain"],
                "provider": item["provider"],
                "source": item["source"],
                "status": item["status"],
                "summary": _loads(item.get("summary_json"), {}),
                "params": _loads(item.get("params_json"), {}),
                "started_at": item["started_at"],
                "finished_at": item["finished_at"],
                "created_at": item["created_at"],
            }
        )
    return jobs


def get_rank_job(job_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM rank_jobs WHERE id = ?", (job_id,)).fetchone()
    if not row:
        return None
    item = dict(row)
    return {
        "id": item["id"],
        "domain": item["domain"],
        "provider": item["provider"],
        "source": item["source"],
        "status": item["status"],
        "summary": _loads(item.get("summary_json"), {}),
        "params": _loads(item.get("params_json"), {}),
        "started_at": item["started_at"],
        "finished_at": item["finished_at"],
        "created_at": item["created_at"],
    }


def list_rank_results(job_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM rank_results WHERE job_id = ? ORDER BY created_at ASC",
            (job_id,),
        ).fetchall()
    results: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        results.append(
            {
                "id": item["id"],
                "job_id": item["job_id"],
                "keyword": item["keyword"],
                "found": bool(item["found"]),
                "page": item["page"],
                "position": item["position"],
                "url": item["url"],
                "provider": item["provider"],
                "error": item["error"],
                "queried_at": item["queried_at"],
            }
        )
    return results
