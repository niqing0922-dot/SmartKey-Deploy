from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

import requests


@dataclass
class RankResult:
    keyword: str
    found: bool
    page: Optional[int] = None
    position: Optional[int] = None
    url: Optional[str] = None
    provider: str = ""
    error: Optional[str] = None
    queried_at: Optional[str] = None


@dataclass
class AccountInfo:
    total_searches_left: Optional[int] = None
    plan_searches_left: Optional[int] = None
    searches_per_month: Optional[int] = None
    this_month_usage: Optional[int] = None


def domain_matches(url: str, target_domain: str) -> bool:
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return False
    host = host.split(":")[0]
    target = target_domain.lower().strip()
    return bool(target) and (host == target or host.endswith(f".{target}"))


class SearchProvider:
    name = "base"

    def find_rank(self, keyword: str, target_domain: str, max_pages: int) -> RankResult:
        raise NotImplementedError

    def get_account_info(self) -> Optional[AccountInfo]:
        return None


class SerpApiProvider(SearchProvider):
    name = "serpapi"

    def __init__(self, api_key: str, hl: str = "en", gl: str = "us", results_per_request: int = 100) -> None:
        self.api_key = api_key
        self.hl = hl
        self.gl = gl
        self.results_per_request = max(10, min(int(results_per_request), 100))
        self.session = requests.Session()

    def find_rank(self, keyword: str, target_domain: str, max_pages: int) -> RankResult:
        search_results_per_page = 10
        request_count = max(
            1,
            (int(max_pages) * search_results_per_page + self.results_per_request - 1) // self.results_per_request,
        )
        for request_index in range(request_count):
            start = request_index * self.results_per_request
            params = {
                "engine": "google",
                "q": keyword,
                "num": self.results_per_request,
                "start": start,
                "api_key": self.api_key,
            }
            if self.hl:
                params["hl"] = self.hl
            if self.gl:
                params["gl"] = self.gl

            response = self.session.get("https://serpapi.com/search.json", params=params, timeout=30)
            response.raise_for_status()
            payload = response.json()
            if payload.get("error"):
                raise RuntimeError(str(payload["error"]))

            results = payload.get("organic_results", []) or []
            for idx, item in enumerate(results, start=1):
                link = item.get("link") or item.get("redirect_link")
                absolute_position = start + idx
                if link and domain_matches(link, target_domain):
                    return RankResult(
                        keyword=keyword,
                        found=True,
                        page=((absolute_position - 1) // search_results_per_page) + 1,
                        position=absolute_position,
                        url=str(link),
                        provider=self.name,
                    )
            if not results:
                break

        return RankResult(keyword=keyword, found=False, provider=self.name)

    def get_account_info(self) -> Optional[AccountInfo]:
        response = self.session.get(
            "https://serpapi.com/account.json",
            params={"api_key": self.api_key},
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        return AccountInfo(
            total_searches_left=payload.get("total_searches_left"),
            plan_searches_left=payload.get("plan_searches_left"),
            searches_per_month=payload.get("searches_per_month"),
            this_month_usage=payload.get("this_month_usage"),
        )


def choose_provider(provider_name: str, api_key: str, hl: str, gl: str, results_per_request: int) -> SearchProvider:
    provider_name = (provider_name or "serpapi").lower().strip()
    if provider_name != "serpapi":
        raise ValueError(f"Unsupported provider: {provider_name}. Built-in core currently supports serpapi.")
    if not api_key.strip():
        raise RuntimeError("SERPAPI_API_KEY is not configured.")
    return SerpApiProvider(api_key=api_key.strip(), hl=hl, gl=gl, results_per_request=results_per_request)


def estimate_credit_cost(keyword_count: int, max_pages: int, results_per_request: int, provider_name: str) -> int:
    if (provider_name or "").lower() != "serpapi":
        return 0
    search_results_per_page = 10
    requests_per_keyword = max(
        1,
        (int(max_pages) * search_results_per_page + int(results_per_request) - 1) // int(results_per_request),
    )
    return int(keyword_count) * requests_per_keyword
