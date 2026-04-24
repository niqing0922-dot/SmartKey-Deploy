from __future__ import annotations

import csv
import io
import re
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)
URL_PATTERN = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)


@dataclass
class InspectionPage:
    url: str
    indexed: bool
    coverage: str
    indexing_state: str
    last_crawl: str
    error: str
    checked_at: str


@dataclass
class SubmissionPage:
    url: str
    success: bool
    status_code: int
    status_message: str
    error: str
    retry_count: int
    timestamp: str


def extract_urls_from_text(content: str) -> list[str]:
    text = content or ""
    urls: list[str] = []
    seen: set[str] = set()

    # 1) XML sitemap <loc> extraction
    for match in re.findall(r"<loc>\s*(https?://[^<\s]+)\s*</loc>", text, flags=re.IGNORECASE):
        url = match.strip()
        if url and url not in seen:
            seen.add(url)
            urls.append(url)

    # 2) Generic URL extraction from any text/csv
    for match in URL_PATTERN.findall(text):
        url = match.strip().rstrip(",;")
        if url and url not in seen:
            seen.add(url)
            urls.append(url)

    # 3) CSV parsing fallback (catches quoted URLs with separators)
    reader = csv.reader(io.StringIO(text))
    for row in reader:
        for cell in row:
            value = (cell or "").strip().strip('"').strip("'")
            if URL_PATTERN.match(value) and value not in seen:
                seen.add(value)
                urls.append(value)

    return urls


def load_urls_from_file(file_path: str) -> list[str]:
    path = Path(file_path).expanduser()
    if not path.exists():
        raise RuntimeError(f"url file not found: {path}")
    if not path.is_file():
        raise RuntimeError(f"url file is not a regular file: {path}")
    content = path.read_text(encoding="utf-8", errors="ignore")
    urls = extract_urls_from_text(content)
    if not urls:
        raise RuntimeError(f"no valid urls found in file: {path}")
    return urls


def normalize_site_url(site_url: str) -> str:
    url = site_url.strip()
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    return url.rstrip("/")


def crawl_site_urls(site_url: str, max_pages: int = 50, crawl_delay: float = 0.5, timeout: int = 15) -> list[str]:
    base = normalize_site_url(site_url)
    domain = urlparse(base).netloc
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    queue = [base]
    visited: set[str] = set()
    collected: list[str] = []

    while queue and len(collected) < max_pages:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)

        try:
            response = session.get(url, timeout=timeout)
            if response.status_code != 200:
                continue
            content_type = response.headers.get("Content-Type", "").lower()
            if "text/html" not in content_type:
                continue
        except Exception:
            continue

        collected.append(url)
        soup = BeautifulSoup(response.text, "html.parser")
        new_links: list[str] = []
        for a in soup.find_all("a", href=True):
            href = (a.get("href") or "").strip()
            if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
                continue
            normalized = urljoin(f"{base}/", href).split("#")[0]
            parsed = urlparse(normalized)
            if parsed.netloc != domain:
                continue
            if normalized not in visited and normalized not in queue and normalized not in new_links:
                new_links.append(normalized.rstrip("/"))

        queue.extend(new_links[:30])
        if queue:
            time.sleep(max(0.0, crawl_delay))

    return collected


def _build_search_console(credentials_path: str):
    credentials = service_account.Credentials.from_service_account_file(
        credentials_path,
        scopes=["https://www.googleapis.com/auth/webmasters.readonly"],
    )
    return build("searchconsole", "v1", credentials=credentials, cache_discovery=False)


def _build_indexing(credentials_path: str):
    credentials = service_account.Credentials.from_service_account_file(
        credentials_path,
        scopes=["https://www.googleapis.com/auth/indexing"],
    )
    return build("indexing", "v3", credentials=credentials, cache_discovery=False)


def inspect_urls(site_url: str, urls: list[str], credentials_path: str, check_delay: float = 0.3) -> list[InspectionPage]:
    service = _build_search_console(credentials_path)
    pages: list[InspectionPage] = []
    site = normalize_site_url(site_url)
    site_for_api = f"{site}/"

    for url in urls:
        checked_at = datetime.now().astimezone().isoformat(timespec="seconds")
        try:
            response = (
                service.urlInspection()
                .index()
                .inspect(body={"inspectionUrl": url, "siteUrl": site_for_api})
                .execute()
            )
            result = response.get("inspectionResult", {}) or {}
            index_status = result.get("indexStatusResult", {}) or {}
            coverage = str(index_status.get("coverageState", "") or "")
            indexing_state = str(index_status.get("indexingState", "") or "")
            indexed = "submitted and indexed" in indexing_state.lower() or "indexed" in coverage.lower()
            pages.append(
                InspectionPage(
                    url=url,
                    indexed=indexed,
                    coverage=coverage,
                    indexing_state=indexing_state,
                    last_crawl=str(index_status.get("lastCrawlTime", "") or ""),
                    error="",
                    checked_at=checked_at,
                )
            )
        except HttpError as exc:
            pages.append(
                InspectionPage(
                    url=url,
                    indexed=False,
                    coverage="",
                    indexing_state="",
                    last_crawl="",
                    error=f"HTTP {exc.resp.status}",
                    checked_at=checked_at,
                )
            )
        except Exception as exc:
            pages.append(
                InspectionPage(
                    url=url,
                    indexed=False,
                    coverage="",
                    indexing_state="",
                    last_crawl="",
                    error=str(exc),
                    checked_at=checked_at,
                )
            )
        time.sleep(max(0.0, check_delay))
    return pages


def submit_urls(urls: list[str], credentials_path: str, submission_type: str = "URL_UPDATED", max_retries: int = 3) -> list[SubmissionPage]:
    service = _build_indexing(credentials_path)
    pages: list[SubmissionPage] = []
    submission_type = (submission_type or "URL_UPDATED").upper()
    if submission_type not in {"URL_UPDATED", "URL_DELETED"}:
        submission_type = "URL_UPDATED"

    for url in urls:
        success = False
        status_code = 0
        status_message = ""
        error = ""
        retries = 0
        timestamp = datetime.now().astimezone().isoformat(timespec="seconds")

        while retries < max(1, max_retries):
            try:
                response = (
                    service.urlNotifications()
                    .publish(body={"url": url, "type": submission_type})
                    .execute()
                )
                success = True
                status_code = 200
                status_message = "OK"
                timestamp = str(response.get("urlNotificationMetadata", {}).get("latestUpdate", {}).get("notifyTime", "") or timestamp)
                break
            except HttpError as exc:
                retries += 1
                status_code = int(exc.resp.status)
                status_message = f"HTTP {status_code}"
                error = str(exc)
                if retries >= max_retries:
                    break
                time.sleep(0.5 * retries)
            except Exception as exc:
                retries += 1
                status_code = 500
                status_message = "ERROR"
                error = str(exc)
                if retries >= max_retries:
                    break
                time.sleep(0.5 * retries)

        pages.append(
            SubmissionPage(
                url=url,
                success=success,
                status_code=status_code,
                status_message=status_message,
                error=error,
                retry_count=max(0, retries - 1),
                timestamp=timestamp,
            )
        )
    return pages
