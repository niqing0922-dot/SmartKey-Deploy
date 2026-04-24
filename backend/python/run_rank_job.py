import json
import os
import sys
import time
import traceback
from datetime import datetime

from backend.services.rank_core import RankResult, choose_provider, estimate_credit_cost


def main():
    payload = json.load(sys.stdin)
    keywords = [str(item).strip() for item in payload.get("keywords", []) if str(item).strip()]
    provider_name = payload.get("provider", "serpapi")
    domain = str(payload.get("domain", "")).strip()
    max_pages = int(payload.get("maxPages", 10))
    results_per_request = int(payload.get("resultsPerRequest", 100))
    hl = payload.get("hl", "en")
    gl = payload.get("gl", "")
    reserve_credits = int(payload.get("reserveCredits", 10))

    if not keywords:
        raise RuntimeError("keywords is required")
    if not domain:
        raise RuntimeError("domain is required")

    started_at = datetime.now().astimezone().isoformat(timespec="seconds")
    provider = choose_provider(
        provider_name=provider_name,
        api_key=os.getenv("SERPAPI_API_KEY", ""),
        hl=hl,
        gl=gl,
        results_per_request=results_per_request,
    )

    account_info = provider.get_account_info()
    if account_info and account_info.total_searches_left is not None:
        per_keyword_cost = max(
            1,
            estimate_credit_cost(1, max_pages, results_per_request, provider_name),
        )
        allowed_keywords = max(0, (account_info.total_searches_left - reserve_credits) // per_keyword_cost)
        if allowed_keywords < len(keywords):
            keywords = keywords[:allowed_keywords]

    results: list[dict] = []
    for keyword in keywords:
        queried_at = datetime.now().astimezone().isoformat(timespec="seconds")
        try:
            result = provider.find_rank(keyword=keyword, target_domain=domain, max_pages=max_pages)
            result.queried_at = queried_at
        except Exception as exc:
            result = RankResult(
                keyword=keyword,
                found=False,
                provider=provider.name,
                error=str(exc),
                queried_at=queried_at,
            )

        results.append(
            {
                "keyword": result.keyword,
                "found": result.found,
                "page": result.page,
                "position": result.position,
                "url": result.url,
                "provider": result.provider,
                "error": result.error,
                "queried_at": result.queried_at,
            }
        )
        time.sleep(0.05)

    finished_at = datetime.now().astimezone().isoformat(timespec="seconds")
    summary = {
        "total": len(results),
        "found": sum(1 for item in results if item["found"]),
        "errors": sum(1 for item in results if item["error"]),
        "notFound": sum(1 for item in results if not item["found"]),
    }

    account_payload = None
    if account_info:
        account_payload = {
            "total_searches_left": account_info.total_searches_left,
            "plan_searches_left": account_info.plan_searches_left,
            "searches_per_month": account_info.searches_per_month,
            "this_month_usage": account_info.this_month_usage,
        }

    print(
        json.dumps(
            {
                "started_at": started_at,
                "finished_at": finished_at,
                "summary": summary,
                "account": account_payload,
                "results": results,
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
