import json
import sys
import traceback
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.services.indexing_core import crawl_site_urls, inspect_urls, load_urls_from_file, submit_urls


def main():
    payload = json.load(sys.stdin)
    action = (payload.get("action") or "inspect").strip().lower()
    started_at = datetime.now().astimezone().isoformat(timespec="seconds")

    if action not in {"inspect", "submit"}:
        raise RuntimeError(f"Unsupported action: {action}")

    credentials_path = str(payload.get("credentialsPath") or payload.get("indexingKeyFile") or "").strip()
    url_file_path = str(payload.get("urlFilePath") or "").strip()
    if not credentials_path:
        raise RuntimeError("credentialsPath is required")

    if action == "inspect":
        site_url = str(payload.get("siteUrl", "")).strip()
        if not site_url:
            raise RuntimeError("siteUrl is required for inspect action")

        max_pages = max(1, int(payload.get("maxPages", 50)))
        crawl_delay = float(payload.get("crawlDelay", 0.5))
        check_delay = float(payload.get("checkDelay", 0.3))
        urls = payload.get("urls", []) or []
        if not urls and url_file_path:
            urls = load_urls_from_file(url_file_path)
        if not urls:
            urls = crawl_site_urls(site_url=site_url, max_pages=max_pages, crawl_delay=crawl_delay)

        inspected = inspect_urls(
            site_url=site_url,
            urls=[str(item).strip() for item in urls if str(item).strip()],
            credentials_path=credentials_path,
            check_delay=check_delay,
        )
        pages = [
            {
                "url": item.url,
                "indexed": item.indexed,
                "coverage": item.coverage,
                "indexing_state": item.indexing_state,
                "last_crawl": item.last_crawl,
                "error": item.error,
                "checked_at": item.checked_at,
            }
            for item in inspected
        ]
        summary = {
            "total": len(pages),
            "success": sum(1 for item in pages if not item["error"]),
            "failed": sum(1 for item in pages if item["error"]),
            "indexed": sum(1 for item in pages if item["indexed"]),
            "unindexed": sum(1 for item in pages if not item["indexed"]),
        }
    else:
        urls = [str(item).strip() for item in (payload.get("urls", []) or []) if str(item).strip()]
        if not urls and url_file_path:
            urls = load_urls_from_file(url_file_path)
        if not urls:
            raise RuntimeError("urls is required for submit action (or provide urlFilePath)")
        submission_type = str(payload.get("submissionType") or "URL_UPDATED").strip().upper()
        max_retries = max(1, int(payload.get("maxRetries", 3)))
        submitted = submit_urls(
            urls=urls,
            credentials_path=credentials_path,
            submission_type=submission_type,
            max_retries=max_retries,
        )
        pages = [
            {
                "url": item.url,
                "success": item.success,
                "status_code": item.status_code,
                "status_message": item.status_message,
                "error": item.error,
                "retry_count": item.retry_count,
                "timestamp": item.timestamp,
            }
            for item in submitted
        ]
        summary = {
            "total": len(pages),
            "success": sum(1 for item in pages if item["success"]),
            "failed": sum(1 for item in pages if not item["success"]),
        }

    finished_at = datetime.now().astimezone().isoformat(timespec="seconds")
    print(
        json.dumps(
            {
                "started_at": started_at,
                "finished_at": finished_at,
                "summary": summary,
                "pages": pages,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
