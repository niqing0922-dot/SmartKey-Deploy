from __future__ import annotations

import csv
import io
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


REPO_ROOT = Path(__file__).resolve().parents[2]
PREP_OUTPUT_DIR = REPO_ROOT / ".artifacts" / "indexing-prep"
ASSET_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".zip"}
INVALID_URL_CHARS = {"*", "<", ">", '"', " ", "\\", "|", "^", "`"}
URL_HEADER_PATTERN = re.compile(r"^\s*url\s*$", re.IGNORECASE)
LAST_CRAWLED_HEADER_PATTERN = re.compile(r"^\s*last crawled\s*$", re.IGNORECASE)
ISSUE_ROW_PATTERN = re.compile(r"^\s*issue\s*$", re.IGNORECASE)


def _timestamp_slug() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _parse_issue_from_metadata(content: str) -> str:
    reader = csv.reader(io.StringIO(content or ""))
    for row in reader:
        if len(row) < 2:
            continue
        if ISSUE_ROW_PATTERN.match(_clean_text(row[0])):
            return _clean_text(row[1])
    return ""


def _extract_urls_from_table(content: str) -> list[str]:
    reader = csv.DictReader(io.StringIO(content or ""))
    if not reader.fieldnames:
        return []

    url_field = ""
    for name in reader.fieldnames:
        field = _clean_text(name)
        if URL_HEADER_PATTERN.match(field):
            url_field = name
            break
        if not url_field and field.lower() == "url":
            url_field = name

    if not url_field:
        lowered = {_clean_text(name).lower(): name for name in reader.fieldnames}
        url_field = lowered.get("url", "")
    if not url_field:
        return []

    urls: list[str] = []
    for row in reader:
        url = _clean_text(row.get(url_field))
        if url:
            urls.append(url)
    return urls


def _is_table_file(content: str) -> bool:
    reader = csv.reader(io.StringIO(content or ""))
    try:
        first_row = next(reader)
    except StopIteration:
        return False
    headers = [_clean_text(item) for item in first_row]
    has_url = any(URL_HEADER_PATTERN.match(item) for item in headers)
    has_last_crawled = any(LAST_CRAWLED_HEADER_PATTERN.match(item) for item in headers)
    return has_url and has_last_crawled


def _classify_url(url: str) -> str:
    text = _clean_text(url)
    if not text:
        return "empty"
    if any(char in text for char in INVALID_URL_CHARS):
        return "invalid_characters"
    parsed = urlparse(text)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return "invalid_url"
    if parsed.path.lower().endswith(tuple(ASSET_EXTENSIONS)):
        return "asset_file"
    if "/news/tags/" in parsed.path.lower():
        return "tag_archive"
    return ""


def _reason_label(reason: str) -> str:
    labels = {
        "empty": "Empty row",
        "invalid_characters": "URL contains unsupported characters",
        "invalid_url": "URL is not a valid absolute http(s) URL",
        "asset_file": "Asset file URL is not suitable for indexing submission",
        "tag_archive": "Tag archive pages are excluded from submit-ready URLs",
    }
    return labels.get(reason, reason or "Unknown")


def _write_text_file(path: Path, rows: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(rows), encoding="utf-8")


def prepare_search_console_export(sources: list[dict[str, str]]) -> dict[str, Any]:
    if not sources:
        raise RuntimeError("No source files provided.")

    table_sources: list[dict[str, Any]] = []
    metadata_issues: list[str] = []
    ignored_files: list[str] = []

    for index, source in enumerate(sources):
        filename = _clean_text(source.get("filename") or f"source_{index + 1}.csv")
        content = str(source.get("content") or "")
        if not content.strip():
            ignored_files.append(filename)
            continue
        issue = _parse_issue_from_metadata(content)
        if issue:
            metadata_issues.append(issue)
            continue
        if _is_table_file(content):
            table_sources.append({"filename": filename, "content": content})
            continue
        ignored_files.append(filename)

    if not table_sources:
        raise RuntimeError("No Search Console Table.csv content found in the uploaded files.")

    paired_issues = metadata_issues[:]
    records: list[dict[str, Any]] = []
    raw_urls: list[str] = []
    seen_urls: set[str] = set()
    submit_ready: list[str] = []
    excluded: list[dict[str, str]] = []
    submit_counts_by_issue: dict[str, int] = {}
    excluded_counts_by_reason: dict[str, int] = {}

    for index, source in enumerate(table_sources):
        issue = paired_issues[index] if index < len(paired_issues) else (paired_issues[0] if len(paired_issues) == 1 else "")
        for raw_url in _extract_urls_from_table(source["content"]):
            url = _clean_text(raw_url)
            if not url:
                continue
            if url in seen_urls:
                excluded.append(
                    {
                        "url": url,
                        "reason": "duplicate",
                        "reason_label": "Duplicate URL",
                        "source_file": source["filename"],
                        "issue": issue,
                    }
                )
                excluded_counts_by_reason["Duplicate URL"] = excluded_counts_by_reason.get("Duplicate URL", 0) + 1
                continue
            seen_urls.add(url)
            raw_urls.append(url)
            reason = _classify_url(url)
            if reason:
                label = _reason_label(reason)
                excluded.append(
                    {
                        "url": url,
                        "reason": reason,
                        "reason_label": label,
                        "source_file": source["filename"],
                        "issue": issue,
                    }
                )
                excluded_counts_by_reason[label] = excluded_counts_by_reason.get(label, 0) + 1
                continue
            submit_ready.append(url)
            issue_label = issue or "Unknown issue"
            submit_counts_by_issue[issue_label] = submit_counts_by_issue.get(issue_label, 0) + 1
            records.append(
                {
                    "url": url,
                    "issue": issue,
                    "source_file": source["filename"],
                }
            )

    timestamp = _timestamp_slug()
    output_dir = PREP_OUTPUT_DIR / timestamp
    output_dir.mkdir(parents=True, exist_ok=True)

    merged_path = output_dir / "merged_urls.txt"
    submit_ready_path = output_dir / "submit_ready_urls.txt"
    excluded_path = output_dir / "excluded_urls.csv"
    summary_path = output_dir / "summary.json"

    _write_text_file(merged_path, raw_urls)
    _write_text_file(submit_ready_path, submit_ready)

    with excluded_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["url", "reason", "reason_label", "source_file", "issue"])
        writer.writeheader()
        writer.writerows(excluded)

    summary = {
        "source_files": [source["filename"] for source in table_sources],
        "ignored_files": ignored_files,
        "metadata_issues": metadata_issues,
        "counts": {
            "raw": len(raw_urls),
            "submit_ready": len(submit_ready),
            "excluded": len(excluded),
        },
        "submit_counts_by_issue": submit_counts_by_issue,
        "excluded_counts_by_reason": excluded_counts_by_reason,
        "generated_files": {
            "merged": str(merged_path),
            "submit_ready": str(submit_ready_path),
            "excluded": str(excluded_path),
        },
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "counts": summary["counts"],
        "submit_ready_urls": submit_ready,
        "excluded_urls": excluded,
        "submit_counts_by_issue": submit_counts_by_issue,
        "excluded_counts_by_reason": excluded_counts_by_reason,
        "source_files": summary["source_files"],
        "ignored_files": ignored_files,
        "metadata_issues": metadata_issues,
        "generated_files": {
            "merged": str(merged_path),
            "submit_ready": str(submit_ready_path),
            "excluded": str(excluded_path),
            "summary": str(summary_path),
        },
        "records": records,
    }
