import json
import os
import shutil
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

DATA_DIR = Path(os.getenv("SMARTKEY_DATA_DIR") or Path(__file__).resolve().parent / "data")
BACKUP_DIR = Path(os.getenv("SMARTKEY_BACKUP_DIR") or DATA_DIR.parent / "backups")
DATA_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "app.db"
LOCAL_USER_ID = "local-user"
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_GOOGLE_CREDENTIALS_PATH = str(REPO_ROOT / "tools" / "google-indexing" / "config" / "service_account.json")

DEFAULT_SETTINGS: dict[str, Any] = {
    "language": "zh",
    "default_market": "Global / English",
    "default_tone": "Professional and clear",
    "default_article_type": "How-to guide",
    "default_content_language": "zh",
    "rank_target_domain": "",
    "default_ai_provider": "minimax",
    "default_seo_api": "serpapi",
    "gemini_enabled": False,
    "minimax_enabled": False,
    "openai_enabled": False,
    "anthropic_enabled": False,
    "deepseek_enabled": False,
    "qwen_enabled": False,
    "moonshot_enabled": False,
    "grok_enabled": False,
    "cohere_enabled": False,
    "minimax_api_key": "",
    "gemini_api_key": "",
    "openai_api_key": "",
    "anthropic_api_key": "",
    "deepseek_api_key": "",
    "qwen_api_key": "",
    "moonshot_api_key": "",
    "grok_api_key": "",
    "cohere_api_key": "",
    "serpapi_key": "",
    "serpapi_enabled": True,
    "dataforseo_api_login": "",
    "dataforseo_api_password": "",
    "dataforseo_enabled": False,
    "python_path": "",
    "google_credentials_path": DEFAULT_GOOGLE_CREDENTIALS_PATH,
    "indexing_enabled": True,
}

AI_PROVIDER_TO_ENABLED_KEY = {
    "gemini": "gemini_enabled",
    "minimax": "minimax_enabled",
    "openai": "openai_enabled",
    "anthropic": "anthropic_enabled",
    "deepseek": "deepseek_enabled",
    "qwen": "qwen_enabled",
    "moonshot": "moonshot_enabled",
    "grok": "grok_enabled",
    "cohere": "cohere_enabled",
}
AI_ENABLED_KEYS = list(AI_PROVIDER_TO_ENABLED_KEY.values())
SEO_PROVIDER_TO_ENABLED_KEY = {
    "serpapi": "serpapi_enabled",
    "dataforseo": "dataforseo_enabled",
}
SEO_ENABLED_KEYS = list(SEO_PROVIDER_TO_ENABLED_KEY.values())
SENSITIVE_SETTINGS_KEYS = {
    "minimax_api_key",
    "gemini_api_key",
    "openai_api_key",
    "anthropic_api_key",
    "deepseek_api_key",
    "qwen_api_key",
    "moonshot_api_key",
    "grok_api_key",
    "cohere_api_key",
    "serpapi_key",
    "dataforseo_api_login",
    "dataforseo_api_password",
    "google_credentials_path",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def make_id() -> str:
    return str(uuid4())


def _loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def _dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def normalize_domain(value: str | None) -> str:
    text = (value or "").strip().lower()
    if not text:
        return ""
    candidate = text if "://" in text else f"https://{text}"
    try:
        parsed = urlparse(candidate)
        host = (parsed.netloc or parsed.path).split("/")[0].strip().lower()
        return host.split(":")[0]
    except Exception:
        return text.split("/")[0].split(":")[0]


def normalize_settings(raw: dict[str, Any] | None) -> dict[str, Any]:
    data = raw or {}
    normalized = {**DEFAULT_SETTINGS}
    for key in DEFAULT_SETTINGS:
        if key in data and data[key] is not None:
            normalized[key] = data[key]
    # Backfill legacy empty settings with the bundled indexing credentials path.
    if not str(normalized.get("google_credentials_path") or "").strip():
        normalized["google_credentials_path"] = DEFAULT_GOOGLE_CREDENTIALS_PATH
    return normalized


def public_settings(settings: dict[str, Any]) -> dict[str, Any]:
    from backend.repositories.settings import public_settings as repo_public_settings

    return repo_public_settings(settings)


@lru_cache(maxsize=None)
def table_columns(table: str) -> set[str]:
    with connect() as conn:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {str(row["name"]) for row in rows}


def filter_record(table: str, record: dict[str, Any]) -> dict[str, Any]:
    columns = table_columns(table)
    return {key: value for key, value in record.items() if key in columns}


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS keywords (
                id TEXT PRIMARY KEY,
                keyword TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'core',
                priority TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'pending',
                notes TEXT NOT NULL DEFAULT '',
                position TEXT NOT NULL DEFAULT '',
                related_article TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS articles (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'draft',
                keyword_ids_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS geo_article_drafts (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                primary_keyword TEXT NOT NULL,
                secondary_keywords_json TEXT NOT NULL DEFAULT '[]',
                audience TEXT NOT NULL DEFAULT '',
                industry TEXT NOT NULL DEFAULT '',
                target_market TEXT NOT NULL DEFAULT '',
                article_type TEXT NOT NULL DEFAULT '',
                tone TEXT NOT NULL DEFAULT '',
                target_length INTEGER NOT NULL DEFAULT 1200,
                brief_json TEXT NOT NULL DEFAULT '{}',
                title_options_json TEXT NOT NULL DEFAULT '[]',
                meta_title TEXT NOT NULL DEFAULT '',
                meta_description TEXT NOT NULL DEFAULT '',
                outline_json TEXT NOT NULL DEFAULT '[]',
                draft_sections_json TEXT NOT NULL DEFAULT '[]',
                faq_json TEXT NOT NULL DEFAULT '[]',
                suggestions_json TEXT NOT NULL DEFAULT '[]',
                provider TEXT NOT NULL DEFAULT 'system',
                status TEXT NOT NULL DEFAULT 'draft',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                id TEXT PRIMARY KEY,
                settings_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS rank_jobs (
                id TEXT PRIMARY KEY,
                domain TEXT NOT NULL DEFAULT '',
                provider TEXT NOT NULL DEFAULT 'serpapi',
                source TEXT NOT NULL DEFAULT 'manual',
                status TEXT NOT NULL DEFAULT 'completed',
                params_json TEXT NOT NULL DEFAULT '{}',
                summary_json TEXT NOT NULL DEFAULT '{}',
                started_at TEXT NOT NULL,
                finished_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS rank_results (
                id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL REFERENCES rank_jobs(id) ON DELETE CASCADE,
                keyword TEXT NOT NULL,
                found INTEGER NOT NULL DEFAULT 0,
                page INTEGER,
                position INTEGER,
                url TEXT NOT NULL DEFAULT '',
                provider TEXT NOT NULL DEFAULT '',
                error TEXT NOT NULL DEFAULT '',
                queried_at TEXT NOT NULL DEFAULT '',
                raw_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS indexing_jobs (
                id TEXT PRIMARY KEY,
                action TEXT NOT NULL DEFAULT 'inspect',
                site_url TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'completed',
                params_json TEXT NOT NULL DEFAULT '{}',
                summary_json TEXT NOT NULL DEFAULT '{}',
                started_at TEXT NOT NULL,
                finished_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS indexing_pages (
                id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL REFERENCES indexing_jobs(id) ON DELETE CASCADE,
                url TEXT NOT NULL,
                indexed INTEGER,
                coverage TEXT NOT NULL DEFAULT '',
                indexing_state TEXT NOT NULL DEFAULT '',
                last_crawl TEXT NOT NULL DEFAULT '',
                success INTEGER,
                status_code INTEGER,
                status_message TEXT NOT NULL DEFAULT '',
                error TEXT NOT NULL DEFAULT '',
                retry_count INTEGER,
                checked_at TEXT NOT NULL DEFAULT '',
                raw_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS indexing_prepare_batches (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'prepared',
                source_files_json TEXT NOT NULL DEFAULT '[]',
                ignored_files_json TEXT NOT NULL DEFAULT '[]',
                metadata_issues_json TEXT NOT NULL DEFAULT '[]',
                counts_json TEXT NOT NULL DEFAULT '{}',
                submit_counts_by_issue_json TEXT NOT NULL DEFAULT '{}',
                excluded_counts_by_reason_json TEXT NOT NULL DEFAULT '{}',
                generated_files_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS indexing_prepare_items (
                id TEXT PRIMARY KEY,
                batch_id TEXT NOT NULL REFERENCES indexing_prepare_batches(id) ON DELETE CASCADE,
                url TEXT NOT NULL,
                item_status TEXT NOT NULL,
                reason TEXT NOT NULL DEFAULT '',
                reason_label TEXT NOT NULL DEFAULT '',
                source_file TEXT NOT NULL DEFAULT '',
                issue TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );
            """
        )
        row = conn.execute("SELECT id FROM app_settings LIMIT 1").fetchone()
        if not row:
            conn.execute(
                "INSERT INTO app_settings (id, settings_json, updated_at) VALUES (?, ?, ?)",
                (make_id(), _dumps(DEFAULT_SETTINGS), now_iso()),
            )


def list_keywords(filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    from backend.repositories.keywords import list_keywords as repo_list_keywords

    return repo_list_keywords(filters)


def get_keyword(keyword_id: str) -> dict[str, Any] | None:
    from backend.repositories.keywords import get_keyword as repo_get_keyword

    return repo_get_keyword(keyword_id)


def create_keyword(payload: dict[str, Any]) -> dict[str, Any]:
    from backend.repositories.keywords import create_keyword as repo_create_keyword

    return repo_create_keyword(payload)


def update_keyword(keyword_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    from backend.repositories.keywords import update_keyword as repo_update_keyword

    return repo_update_keyword(keyword_id, payload)


def delete_keyword(keyword_id: str) -> None:
    from backend.repositories.keywords import delete_keyword as repo_delete_keyword

    repo_delete_keyword(keyword_id)


def list_articles() -> list[dict[str, Any]]:
    from backend.repositories.articles import list_articles as repo_list_articles

    return repo_list_articles()


def get_article(article_id: str) -> dict[str, Any] | None:
    from backend.repositories.articles import get_article as repo_get_article

    return repo_get_article(article_id)


def create_article(payload: dict[str, Any]) -> dict[str, Any]:
    from backend.repositories.articles import create_article as repo_create_article

    return repo_create_article(payload)


def update_article(article_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    from backend.repositories.articles import update_article as repo_update_article

    return repo_update_article(article_id, payload)


def delete_article(article_id: str) -> None:
    from backend.repositories.articles import delete_article as repo_delete_article

    repo_delete_article(article_id)


def _map_geo_row(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    item = dict(row)
    item["secondary_keywords"] = _loads(item.pop("secondary_keywords_json", item.pop("secondary_keywords", "[]")), [])
    item["brief"] = _loads(item.pop("brief_json", "{}"), {})
    seo_data = _loads(item.pop("seo_json", "{}"), {})
    article_data = _loads(item.pop("article_json", "{}"), {})
    item["title_options"] = _loads(item.pop("title_options_json", "[]"), []) or seo_data.get("title_options", [])
    item["meta_title"] = item.get("meta_title", "") or seo_data.get("meta_title", "")
    item["meta_description"] = item.get("meta_description", "") or seo_data.get("meta_description", "")
    outline_data = _loads(item.pop("outline_json", "[]"), [])
    if isinstance(outline_data, dict):
        outline_data = outline_data.get("sections", [])
    item["outline"] = outline_data if isinstance(outline_data, list) else []
    draft_sections_data = _loads(item.pop("draft_sections_json", "[]"), []) or article_data.get("draft_sections", [])
    item["draft_sections"] = draft_sections_data if isinstance(draft_sections_data, list) else []
    faq_data = _loads(item.pop("faq_json", "[]"), []) or seo_data.get("faq", [])
    item["faq"] = faq_data if isinstance(faq_data, list) else []
    suggestions_data = _loads(item.pop("suggestions_json", "[]"), []) or seo_data.get("suggestions", [])
    item["suggestions"] = suggestions_data if isinstance(suggestions_data, list) else []
    item["audience"] = item.get("audience", "")
    item["provider"] = item.get("provider", "system")
    return item


def list_geo_drafts() -> list[dict[str, Any]]:
    from backend.repositories.geo_drafts import list_geo_drafts as repo_list_geo_drafts

    return repo_list_geo_drafts()


def get_geo_draft(draft_id: str) -> dict[str, Any] | None:
    from backend.repositories.geo_drafts import get_geo_draft as repo_get_geo_draft

    return repo_get_geo_draft(draft_id)


def save_geo_draft(payload: dict[str, Any]) -> dict[str, Any]:
    from backend.repositories.geo_drafts import save_geo_draft as repo_save_geo_draft

    return repo_save_geo_draft(payload)


def get_settings() -> dict[str, Any]:
    from backend.repositories.settings import get_settings as repo_get_settings

    return repo_get_settings()


def save_settings(patch: dict[str, Any]) -> dict[str, Any]:
    from backend.repositories.settings import save_settings as repo_save_settings

    return repo_save_settings(patch)


def create_rank_job(payload: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    from backend.repositories.rank import create_rank_job as repo_create_rank_job

    return repo_create_rank_job(payload, result)


def list_rank_jobs(limit: int = 20) -> list[dict[str, Any]]:
    from backend.repositories.rank import list_rank_jobs as repo_list_rank_jobs

    return repo_list_rank_jobs(limit)


def get_rank_job(job_id: str) -> dict[str, Any] | None:
    from backend.repositories.rank import get_rank_job as repo_get_rank_job

    return repo_get_rank_job(job_id)


def list_rank_results(job_id: str) -> list[dict[str, Any]]:
    from backend.repositories.rank import list_rank_results as repo_list_rank_results

    return repo_list_rank_results(job_id)


def create_indexing_job(payload: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    from backend.repositories.indexing import create_indexing_job as repo_create_indexing_job

    return repo_create_indexing_job(payload, result)


def list_indexing_jobs(limit: int = 20) -> list[dict[str, Any]]:
    from backend.repositories.indexing import list_indexing_jobs as repo_list_indexing_jobs

    return repo_list_indexing_jobs(limit)


def list_indexing_pages(job_id: str) -> list[dict[str, Any]]:
    from backend.repositories.indexing import list_indexing_pages as repo_list_indexing_pages

    return repo_list_indexing_pages(job_id)


def dashboard_stats() -> dict[str, Any]:
    keywords = list_keywords()
    articles = list_articles()
    local_summary = local_data_summary()
    total = len(keywords)
    done = len([item for item in keywords if item["status"] == "done"])
    planned = len([item for item in keywords if item["status"] == "planned"])
    pending = len([item for item in keywords if item["status"] == "pending"])
    coverage = round((done / total) * 100) if total else 0
    from backend.repositories.settings import get_runtime_settings

    settings = get_runtime_settings()
    ai_key_toggle_pairs = [
        ("gemini_api_key", "gemini_enabled"),
        ("minimax_api_key", "minimax_enabled"),
        ("openai_api_key", "openai_enabled"),
        ("anthropic_api_key", "anthropic_enabled"),
        ("deepseek_api_key", "deepseek_enabled"),
        ("qwen_api_key", "qwen_enabled"),
        ("moonshot_api_key", "moonshot_enabled"),
        ("grok_api_key", "grok_enabled"),
        ("cohere_api_key", "cohere_enabled"),
    ]
    return {
        "keywords": {"total": total, "done": done, "planned": planned, "pending": pending, "coverage": coverage},
        "recent_articles": articles[:5],
        "pending_keywords": [item for item in keywords if item["status"] == "pending"][:8],
        "local_data": local_summary,
        "modules": {
            "ai": any(bool(settings.get(key)) and bool(settings.get(toggle)) for key, toggle in ai_key_toggle_pairs),
            "rank": (bool(settings.get("serpapi_key")) and bool(settings.get("serpapi_enabled"))) or (
                bool(settings.get("dataforseo_api_login")) and bool(settings.get("dataforseo_api_password")) and bool(settings.get("dataforseo_enabled"))
            ),
            "indexing": bool(settings.get("google_credentials_path")) and bool(settings.get("indexing_enabled")),
        },
    }


def export_snapshot() -> dict[str, Any]:
    return {
        "exported_at": now_iso(),
        "keywords": list_keywords(),
        "articles": list_articles(),
        "geo_article_drafts": list_geo_drafts(),
        "app_settings": get_settings(),
    }


def import_snapshot(snapshot: dict[str, Any]) -> None:
    reset_local_data("all")
    for item in snapshot.get("keywords", []):
        payload = {**item, "id": item.get("id") or make_id()}
        with connect() as conn:
            conn.execute(
                "INSERT INTO keywords (id, keyword, type, priority, status, notes, position, related_article, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (payload["id"], payload.get("keyword", ""), payload.get("type", "core"), payload.get("priority", "medium"), payload.get("status", "pending"), payload.get("notes", ""), payload.get("position", ""), payload.get("related_article", ""), payload.get("created_at", now_iso()), payload.get("updated_at", now_iso())),
            )
    for item in snapshot.get("articles", []):
        with connect() as conn:
            conn.execute(
                "INSERT INTO articles (id, title, content, status, keyword_ids_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (item.get("id") or make_id(), item.get("title", "Untitled"), item.get("content", ""), item.get("status", "draft"), _dumps(item.get("keyword_ids", [])), item.get("created_at", now_iso()), item.get("updated_at", now_iso())),
            )
    for item in snapshot.get("geo_article_drafts", []):
        save_geo_draft(item)
    if snapshot.get("app_settings"):
        save_settings(snapshot["app_settings"])


def local_data_summary() -> dict[str, Any]:
    size_bytes = DB_PATH.stat().st_size if DB_PATH.exists() else 0
    backups = list_backups()
    return {
        "database_path": str(DB_PATH),
        "backup_dir": str(BACKUP_DIR),
        "size_bytes": size_bytes,
        "backup_count": len(backups),
        "table_counts": {
            "keywords": len(list_keywords()),
            "articles": len(list_articles()),
            "geo_article_drafts": len(list_geo_drafts()),
        },
    }


def create_backup() -> str:
    target = BACKUP_DIR / f"smartkey-backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.db"
    if DB_PATH.exists():
        shutil.copy2(DB_PATH, target)
    else:
        target.touch()
    return str(target)


def list_backups() -> list[dict[str, Any]]:
    backups = []
    for item in sorted(BACKUP_DIR.glob("*.db"), key=lambda entry: entry.stat().st_mtime, reverse=True):
        stat = item.stat()
        backups.append({"name": item.name, "path": str(item), "size_bytes": stat.st_size, "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()})
    return backups


def reset_local_data(mode: str = "content") -> None:
    with connect() as conn:
        conn.execute("DELETE FROM indexing_prepare_items")
        conn.execute("DELETE FROM indexing_prepare_batches")
        conn.execute("DELETE FROM geo_article_drafts")
        conn.execute("DELETE FROM articles")
        conn.execute("DELETE FROM keywords")
        if mode == "all":
            conn.execute("DELETE FROM app_settings")
            conn.execute("INSERT INTO app_settings (id, settings_json, updated_at) VALUES (?, ?, ?)", (make_id(), _dumps(DEFAULT_SETTINGS), now_iso()))
