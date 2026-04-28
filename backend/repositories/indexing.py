from typing import Any

from backend.db import _dumps, _loads, connect, filter_record, make_id, now_iso


def create_indexing_job(payload: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    timestamp = now_iso()
    record = {
        "id": make_id(),
        "action": payload.get("action", "inspect"),
        "site_url": payload.get("siteUrl", ""),
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
            INSERT INTO indexing_jobs (id, action, site_url, status, params_json, summary_json, started_at, finished_at, created_at)
            VALUES (:id, :action, :site_url, :status, :params_json, :summary_json, :started_at, :finished_at, :created_at)
            """,
            record,
        )
        for item in result.get("pages", []) or []:
            page_record = filter_record(
                "indexing_pages",
                {
                    "id": make_id(),
                    "job_id": record["id"],
                    "url": str(item.get("url", "")),
                    "indexed": None if item.get("indexed") is None else (1 if bool(item.get("indexed")) else 0),
                    "coverage": str(item.get("coverage", "") or ""),
                    "indexing_state": str(item.get("indexing_state", "") or ""),
                    "last_crawl": str(item.get("last_crawl", "") or ""),
                    "success": None if item.get("success") is None else (1 if bool(item.get("success")) else 0),
                    "submission_success": None if item.get("success") is None else (1 if bool(item.get("success")) else 0),
                    "status_code": item.get("status_code"),
                    "status_message": str(item.get("status_message", "") or ""),
                    "error": str(item.get("error", "") or ""),
                    "retry_count": item.get("retry_count"),
                    "checked_at": str(item.get("checked_at", "") or item.get("timestamp", "") or ""),
                    "raw_json": _dumps(item),
                    "raw": _dumps(item),
                    "created_at": timestamp,
                },
            )
            columns = ", ".join(page_record.keys())
            placeholders = ", ".join(f":{key}" for key in page_record.keys())
            conn.execute(f"INSERT INTO indexing_pages ({columns}) VALUES ({placeholders})", page_record)
    return {
        "id": record["id"],
        "action": record["action"],
        "site_url": record["site_url"],
        "status": record["status"],
        "summary": _loads(record["summary_json"], {}),
        "started_at": record["started_at"],
        "finished_at": record["finished_at"],
        "created_at": record["created_at"],
    }


def list_indexing_jobs(limit: int = 20) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM indexing_jobs ORDER BY created_at DESC LIMIT ?",
            (max(1, int(limit)),),
        ).fetchall()
    jobs: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        jobs.append(
            {
                "id": item["id"],
                "action": item["action"],
                "site_url": item["site_url"],
                "status": item["status"],
                "summary": _loads(item.get("summary_json"), {}),
                "params": _loads(item.get("params_json"), {}),
                "started_at": item["started_at"],
                "finished_at": item["finished_at"],
                "created_at": item["created_at"],
            }
        )
    return jobs


def list_indexing_pages(job_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM indexing_pages WHERE job_id = ? ORDER BY created_at ASC",
            (job_id,),
        ).fetchall()
    pages: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        indexed_value = item.get("indexed")
        success_value = item.get("success")
        if success_value is None and "submission_success" in item:
            success_value = item.get("submission_success")
        pages.append(
            {
                "id": item["id"],
                "job_id": item["job_id"],
                "url": item["url"],
                "indexed": None if indexed_value is None else bool(indexed_value),
                "coverage": item.get("coverage", ""),
                "indexing_state": item.get("indexing_state", ""),
                "last_crawl": item.get("last_crawl", ""),
                "success": None if success_value is None else bool(success_value),
                "status_code": item.get("status_code"),
                "status_message": item.get("status_message", ""),
                "error": item.get("error", ""),
                "retry_count": item.get("retry_count"),
                "checked_at": item.get("checked_at", ""),
            }
        )
    return pages
