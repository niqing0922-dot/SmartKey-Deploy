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
    safe = {**settings}
    for key in SENSITIVE_SETTINGS_KEYS:
        safe[key] = ""
    safe["gemini_api_key_configured"] = bool(settings.get("gemini_api_key"))
    safe["minimax_api_key_configured"] = bool(settings.get("minimax_api_key"))
    safe["openai_api_key_configured"] = bool(settings.get("openai_api_key"))
    safe["anthropic_api_key_configured"] = bool(settings.get("anthropic_api_key"))
    safe["deepseek_api_key_configured"] = bool(settings.get("deepseek_api_key"))
    safe["qwen_api_key_configured"] = bool(settings.get("qwen_api_key"))
    safe["moonshot_api_key_configured"] = bool(settings.get("moonshot_api_key"))
    safe["grok_api_key_configured"] = bool(settings.get("grok_api_key"))
    safe["cohere_api_key_configured"] = bool(settings.get("cohere_api_key"))
    safe["serpapi_key_configured"] = bool(settings.get("serpapi_key"))
    safe["dataforseo_api_login_configured"] = bool(settings.get("dataforseo_api_login"))
    safe["dataforseo_api_password_configured"] = bool(settings.get("dataforseo_api_password"))
    safe["google_credentials_path_configured"] = bool(settings.get("google_credentials_path"))
    return safe


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
            """
        )
        row = conn.execute("SELECT id FROM app_settings LIMIT 1").fetchone()
        if not row:
            conn.execute(
                "INSERT INTO app_settings (id, settings_json, updated_at) VALUES (?, ?, ?)",
                (make_id(), _dumps(DEFAULT_SETTINGS), now_iso()),
            )


def list_keywords(filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    filters = filters or {}
    where = []
    params: list[Any] = []
    for key in ("status", "type", "priority"):
        value = filters.get(key)
        if value and value != "all":
            where.append(f"{key} = ?")
            params.append(value)
    if filters.get("search"):
        where.append("keyword LIKE ?")
        params.append(f"%{filters['search']}%")
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    with connect() as conn:
        rows = conn.execute(f"SELECT * FROM keywords {clause} ORDER BY created_at DESC", params).fetchall()
    return [dict(row) for row in rows]


def get_keyword(keyword_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM keywords WHERE id = ?", (keyword_id,)).fetchone()
    return dict(row) if row else None


def create_keyword(payload: dict[str, Any]) -> dict[str, Any]:
    record = {
        "id": make_id(),
        "user_id": LOCAL_USER_ID,
        "keyword": payload["keyword"].strip(),
        "type": payload.get("type") or "core",
        "priority": payload.get("priority") or "medium",
        "status": payload.get("status") or "pending",
        "notes": payload.get("notes") or "",
        "position": payload.get("position") or "",
        "related_article": payload.get("related_article") or "",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    db_record = filter_record("keywords", record)
    with connect() as conn:
        columns = ", ".join(db_record.keys())
        placeholders = ", ".join(f":{key}" for key in db_record.keys())
        conn.execute(
            f"INSERT INTO keywords ({columns}) VALUES ({placeholders})",
            db_record,
        )
    return record


def update_keyword(keyword_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    current = get_keyword(keyword_id)
    if not current:
        return None
    for key in ("keyword", "type", "priority", "status", "notes", "position", "related_article"):
        if key in payload and payload[key] is not None:
            current[key] = payload[key]
    current["updated_at"] = now_iso()
    with connect() as conn:
        conn.execute(
            "UPDATE keywords SET keyword=:keyword, type=:type, priority=:priority, status=:status, notes=:notes, position=:position, related_article=:related_article, updated_at=:updated_at WHERE id=:id",
            current,
        )
    return current


def delete_keyword(keyword_id: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM keywords WHERE id = ?", (keyword_id,))


def _map_article(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    item = dict(row)
    keyword_ids_raw = item.pop("keyword_ids_json", item.pop("keyword_ids", "[]"))
    item["keyword_ids"] = _loads(keyword_ids_raw, [])
    return item


def list_articles() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM articles ORDER BY updated_at DESC").fetchall()
    return [_map_article(row) for row in rows]


def get_article(article_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM articles WHERE id = ?", (article_id,)).fetchone()
    return _map_article(row) if row else None


def create_article(payload: dict[str, Any]) -> dict[str, Any]:
    record = {
        "id": make_id(),
        "user_id": LOCAL_USER_ID,
        "title": payload["title"].strip(),
        "content": payload.get("content") or "",
        "status": payload.get("status") or "draft",
        "keyword_ids": payload.get("keyword_ids") or [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    db_record = filter_record(
        "articles",
        {
            "id": record["id"],
            "user_id": record["user_id"],
            "title": record["title"],
            "content": record["content"],
            "status": record["status"],
            "keyword_ids_json": _dumps(record["keyword_ids"]),
            "keyword_ids": _dumps(record["keyword_ids"]),
            "created_at": record["created_at"],
            "updated_at": record["updated_at"],
        },
    )
    with connect() as conn:
        columns = ", ".join(db_record.keys())
        placeholders = ", ".join(f":{key}" for key in db_record.keys())
        conn.execute(
            f"INSERT INTO articles ({columns}) VALUES ({placeholders})",
            db_record,
        )
    return record


def update_article(article_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    current = get_article(article_id)
    if not current:
        return None
    for key in ("title", "content", "status", "keyword_ids"):
        if key in payload and payload[key] is not None:
            current[key] = payload[key]
    current["updated_at"] = now_iso()
    db_patch = filter_record(
        "articles",
        {
            "id": article_id,
            "title": current["title"],
            "content": current["content"],
            "status": current["status"],
            "keyword_ids_json": _dumps(current["keyword_ids"]),
            "keyword_ids": _dumps(current["keyword_ids"]),
            "updated_at": current["updated_at"],
        },
    )
    with connect() as conn:
        assignments = ", ".join(f"{key} = :{key}" for key in db_patch.keys() if key != "id")
        conn.execute(f"UPDATE articles SET {assignments} WHERE id = :id", db_patch)
    return current


def delete_article(article_id: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM articles WHERE id = ?", (article_id,))


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
    with connect() as conn:
        rows = conn.execute("SELECT * FROM geo_article_drafts ORDER BY updated_at DESC").fetchall()
    return [_map_geo_row(row) for row in rows]


def get_geo_draft(draft_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM geo_article_drafts WHERE id = ?", (draft_id,)).fetchone()
    return _map_geo_row(row) if row else None


def save_geo_draft(payload: dict[str, Any]) -> dict[str, Any]:
    timestamp = now_iso()
    record = {
        "id": payload.get("id") or make_id(),
        "user_id": LOCAL_USER_ID,
        "title": payload["title"],
        "primary_keyword": payload["primary_keyword"],
        "secondary_keywords_json": _dumps(payload.get("secondary_keywords", [])),
        "secondary_keywords": _dumps(payload.get("secondary_keywords", [])),
        "audience": payload.get("audience", ""),
        "industry": payload.get("industry", ""),
        "target_market": payload.get("target_market", ""),
        "article_type": payload.get("article_type", ""),
        "tone": payload.get("tone", ""),
        "target_length": int(payload.get("target_length") or 1200),
        "brief_json": _dumps(payload.get("brief", {})),
        "seo_json": _dumps(
            {
                "title_options": payload.get("title_options", []),
                "meta_title": payload.get("meta_title", ""),
                "meta_description": payload.get("meta_description", ""),
                "faq": payload.get("faq", []),
                "suggestions": payload.get("suggestions", []),
            }
        ),
        "title_options_json": _dumps(payload.get("title_options", [])),
        "meta_title": payload.get("meta_title", ""),
        "meta_description": payload.get("meta_description", ""),
        "outline_json": _dumps(payload.get("outline", [])),
        "article_json": _dumps({"draft_sections": payload.get("draft_sections", [])}),
        "draft_sections_json": _dumps(payload.get("draft_sections", [])),
        "faq_json": _dumps(payload.get("faq", [])),
        "suggestions_json": _dumps(payload.get("suggestions", [])),
        "provider": payload.get("provider", "system"),
        "status": payload.get("status", "draft"),
        "created_at": payload.get("created_at") or timestamp,
        "updated_at": timestamp,
    }
    db_record = filter_record("geo_article_drafts", record)
    with connect() as conn:
        exists = conn.execute("SELECT id FROM geo_article_drafts WHERE id = ?", (record["id"],)).fetchone()
        if exists:
            assignments = ", ".join(f"{key}=:{key}" for key in db_record.keys() if key != "id")
            conn.execute(
                f"UPDATE geo_article_drafts SET {assignments} WHERE id=:id",
                db_record,
            )
        else:
            columns = ", ".join(db_record.keys())
            placeholders = ", ".join(f":{key}" for key in db_record.keys())
            conn.execute(
                f"INSERT INTO geo_article_drafts ({columns}) VALUES ({placeholders})",
                db_record,
            )
    return get_geo_draft(record["id"])  # type: ignore[return-value]


def get_settings() -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT settings_json FROM app_settings LIMIT 1").fetchone()
    return normalize_settings(_loads(row["settings_json"] if row else None, {}))


def save_settings(patch: dict[str, Any]) -> dict[str, Any]:
    last_enabled_ai_provider = patch.pop("last_enabled_ai_provider", None)
    last_enabled_seo_provider = patch.pop("last_enabled_seo_provider", None)
    current = get_settings()
    for key, value in patch.items():
        if key not in DEFAULT_SETTINGS:
            continue
        if key in SENSITIVE_SETTINGS_KEYS:
            if value is None or (isinstance(value, str) and not value.strip()):
                # Keep existing secret when UI sends empty placeholders.
                continue
        if key == "rank_target_domain":
            value = normalize_domain(value if isinstance(value, str) else "")
        current[key] = value

    def normalize_single_enabled(
        enabled_keys: list[str],
        preferred_provider: str | None,
        provider_to_key: dict[str, str],
    ) -> None:
        enabled_now = [key for key in enabled_keys if bool(current.get(key))]
        if len(enabled_now) <= 1:
            return
        winner: str | None = None
        preferred_key = provider_to_key.get(str(preferred_provider or "").lower())
        if preferred_key and preferred_key in enabled_now:
            winner = preferred_key
        if winner is None:
            for key, value in patch.items():
                if key in enabled_keys and bool(value):
                    winner = key
        if winner is None:
            winner = enabled_now[-1]
        for key in enabled_keys:
            current[key] = key == winner

    normalize_single_enabled(AI_ENABLED_KEYS, last_enabled_ai_provider, AI_PROVIDER_TO_ENABLED_KEY)
    normalize_single_enabled(SEO_ENABLED_KEYS, last_enabled_seo_provider, SEO_PROVIDER_TO_ENABLED_KEY)
    with connect() as conn:
        row = conn.execute("SELECT id FROM app_settings LIMIT 1").fetchone()
        if row:
            conn.execute("UPDATE app_settings SET settings_json = ?, updated_at = ? WHERE id = ?", (_dumps(current), now_iso(), row["id"]))
        else:
            record = filter_record(
                "app_settings",
                {
                    "id": make_id(),
                    "user_id": LOCAL_USER_ID,
                    "settings_json": _dumps(current),
                    "created_at": now_iso(),
                    "updated_at": now_iso(),
                },
            )
            columns = ", ".join(record.keys())
            placeholders = ", ".join("?" for _ in record.keys())
            conn.execute(f"INSERT INTO app_settings ({columns}) VALUES ({placeholders})", tuple(record.values()))
    return current


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
                    "user_id": LOCAL_USER_ID,
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
                # Legacy rows may not have submission-only columns.
                "success": None if success_value is None else bool(success_value),
                "status_code": item.get("status_code"),
                "status_message": item.get("status_message", ""),
                "error": item.get("error", ""),
                "retry_count": item.get("retry_count"),
                "checked_at": item.get("checked_at", ""),
            }
        )
    return pages


def dashboard_stats() -> dict[str, Any]:
    keywords = list_keywords()
    articles = list_articles()
    local_summary = local_data_summary()
    total = len(keywords)
    done = len([item for item in keywords if item["status"] == "done"])
    planned = len([item for item in keywords if item["status"] == "planned"])
    pending = len([item for item in keywords if item["status"] == "pending"])
    coverage = round((done / total) * 100) if total else 0
    settings = get_settings()
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
        conn.execute("DELETE FROM geo_article_drafts")
        conn.execute("DELETE FROM articles")
        conn.execute("DELETE FROM keywords")
        if mode == "all":
            conn.execute("DELETE FROM app_settings")
            conn.execute("INSERT INTO app_settings (id, settings_json, updated_at) VALUES (?, ?, ?)", (make_id(), _dumps(DEFAULT_SETTINGS), now_iso()))
