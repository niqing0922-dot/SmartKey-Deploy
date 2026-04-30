import json
from contextlib import contextmanager
from typing import Any

import psycopg
from fastapi import HTTPException
from psycopg.rows import dict_row

from backend.auth import CloudContext
from backend.config import get_app_settings
from backend.db import DEFAULT_SETTINGS, normalize_settings, now_iso


@contextmanager
def cloud_connect():
    settings = get_app_settings()
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        yield conn


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _loads(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(str(value))
    except json.JSONDecodeError:
        return fallback


def _assert_member(conn: psycopg.Connection, ctx: CloudContext) -> None:
    row = conn.execute(
        "SELECT 1 FROM workspace_members WHERE workspace_id = %s AND user_id = %s LIMIT 1",
        (ctx.workspace_id, ctx.user_id),
    ).fetchone()
    if not row:
        raise HTTPException(
            status_code=403,
            detail={"code": "workspace_forbidden", "message": "You do not have access to this workspace."},
        )


def ensure_profile_and_default_workspace(ctx: CloudContext) -> dict[str, Any]:
    with cloud_connect() as conn:
        conn.execute(
            """
            INSERT INTO profiles (id, email, display_name, created_at, updated_at)
            VALUES (%s, %s, %s, now(), now())
            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now()
            """,
            (ctx.user_id, ctx.email, ctx.email.split("@")[0] if ctx.email else "SmartKey User"),
        )
        row = conn.execute(
            """
            SELECT w.id, w.name, wm.role
            FROM workspaces w
            JOIN workspace_members wm ON wm.workspace_id = w.id
            WHERE wm.user_id = %s
            ORDER BY w.created_at ASC
            LIMIT 1
            """,
            (ctx.user_id,),
        ).fetchone()
        if not row:
            row = conn.execute(
                """
                INSERT INTO workspaces (name, created_by, created_at, updated_at)
                VALUES (%s, %s, now(), now())
                RETURNING id, name
                """,
                ("SmartKey Workspace", ctx.user_id),
            ).fetchone()
            conn.execute(
                """
                INSERT INTO workspace_members (workspace_id, user_id, role, created_at)
                VALUES (%s, %s, 'owner', now())
                ON CONFLICT (workspace_id, user_id) DO NOTHING
                """,
                (row["id"], ctx.user_id),
            )
            row = {**row, "role": "owner"}
        return {"id": str(row["id"]), "name": row["name"], "role": row["role"]}


def list_workspaces(ctx: CloudContext) -> list[dict[str, Any]]:
    ensure_profile_and_default_workspace(ctx)
    with cloud_connect() as conn:
        rows = conn.execute(
            """
            SELECT w.id, w.name, wm.role
            FROM workspaces w
            JOIN workspace_members wm ON wm.workspace_id = w.id
            WHERE wm.user_id = %s
            ORDER BY w.created_at ASC
            """,
            (ctx.user_id,),
        ).fetchall()
    return [{"id": str(row["id"]), "name": row["name"], "role": row["role"]} for row in rows]


def list_keywords(ctx: CloudContext, filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    filters = filters or {}
    where = ["workspace_id = %s"]
    params: list[Any] = [ctx.workspace_id]
    for key in ("status", "type", "priority"):
        value = filters.get(key)
        if value and value != "all":
            where.append(f"{key} = %s")
            params.append(value)
    if filters.get("search"):
        where.append("keyword ILIKE %s")
        params.append(f"%{filters['search']}%")
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        rows = conn.execute(
            f"""
            SELECT id, keyword, type, priority, status, notes, position, related_article, created_at, updated_at
            FROM keywords
            WHERE {' AND '.join(where)}
            ORDER BY created_at DESC
            """,
            params,
        ).fetchall()
    return [{**row, "id": str(row["id"])} for row in rows]


def get_keyword(ctx: CloudContext, keyword_id: str) -> dict[str, Any] | None:
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        row = conn.execute(
            """
            SELECT id, keyword, type, priority, status, notes, position, related_article, created_at, updated_at
            FROM keywords WHERE id = %s AND workspace_id = %s
            """,
            (keyword_id, ctx.workspace_id),
        ).fetchone()
    return {**row, "id": str(row["id"])} if row else None


def create_keyword(ctx: CloudContext, payload: dict[str, Any]) -> dict[str, Any]:
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        row = conn.execute(
            """
            INSERT INTO keywords (workspace_id, keyword, type, priority, status, notes, position, related_article, created_by, updated_by, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), now())
            RETURNING id, keyword, type, priority, status, notes, position, related_article, created_at, updated_at
            """,
            (
                ctx.workspace_id,
                payload["keyword"].strip(),
                payload.get("type") or "core",
                payload.get("priority") or "medium",
                payload.get("status") or "pending",
                payload.get("notes") or "",
                payload.get("position") or "",
                payload.get("related_article") or "",
                ctx.user_id,
                ctx.user_id,
            ),
        ).fetchone()
    return {**row, "id": str(row["id"])}


def update_keyword(ctx: CloudContext, keyword_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    current = get_keyword(ctx, keyword_id)
    if not current:
        return None
    for key in ("keyword", "type", "priority", "status", "notes", "position", "related_article"):
        if key in payload and payload[key] is not None:
            current[key] = payload[key]
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        row = conn.execute(
            """
            UPDATE keywords
            SET keyword=%s, type=%s, priority=%s, status=%s, notes=%s, position=%s, related_article=%s, updated_by=%s, updated_at=now()
            WHERE id=%s AND workspace_id=%s
            RETURNING id, keyword, type, priority, status, notes, position, related_article, created_at, updated_at
            """,
            (
                current["keyword"],
                current["type"],
                current["priority"],
                current["status"],
                current["notes"],
                current["position"],
                current["related_article"],
                ctx.user_id,
                keyword_id,
                ctx.workspace_id,
            ),
        ).fetchone()
    return {**row, "id": str(row["id"])} if row else None


def delete_keyword(ctx: CloudContext, keyword_id: str) -> None:
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        conn.execute("DELETE FROM keywords WHERE id = %s AND workspace_id = %s", (keyword_id, ctx.workspace_id))


def _map_article(row: dict[str, Any]) -> dict[str, Any]:
    item = {**row, "id": str(row["id"])}
    item["keyword_ids"] = _loads(item.pop("keyword_ids_json", item.pop("keyword_ids", [])), [])
    return item


def list_articles(ctx: CloudContext) -> list[dict[str, Any]]:
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        rows = conn.execute(
            """
            SELECT id, title, content, status, keyword_ids_json, created_at, updated_at
            FROM articles WHERE workspace_id = %s ORDER BY updated_at DESC
            """,
            (ctx.workspace_id,),
        ).fetchall()
    return [_map_article(row) for row in rows]


def get_article(ctx: CloudContext, article_id: str) -> dict[str, Any] | None:
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        row = conn.execute(
            """
            SELECT id, title, content, status, keyword_ids_json, created_at, updated_at
            FROM articles WHERE id = %s AND workspace_id = %s
            """,
            (article_id, ctx.workspace_id),
        ).fetchone()
    return _map_article(row) if row else None


def create_article(ctx: CloudContext, payload: dict[str, Any]) -> dict[str, Any]:
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        row = conn.execute(
            """
            INSERT INTO articles (workspace_id, title, content, status, keyword_ids_json, created_by, updated_by, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s, now(), now())
            RETURNING id, title, content, status, keyword_ids_json, created_at, updated_at
            """,
            (
                ctx.workspace_id,
                payload["title"].strip(),
                payload.get("content") or "",
                payload.get("status") or "draft",
                _json(payload.get("keyword_ids") or []),
                ctx.user_id,
                ctx.user_id,
            ),
        ).fetchone()
    return _map_article(row)


def update_article(ctx: CloudContext, article_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    current = get_article(ctx, article_id)
    if not current:
        return None
    for key in ("title", "content", "status", "keyword_ids"):
        if key in payload and payload[key] is not None:
            current[key] = payload[key]
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        row = conn.execute(
            """
            UPDATE articles
            SET title=%s, content=%s, status=%s, keyword_ids_json=%s::jsonb, updated_by=%s, updated_at=now()
            WHERE id=%s AND workspace_id=%s
            RETURNING id, title, content, status, keyword_ids_json, created_at, updated_at
            """,
            (
                current["title"],
                current["content"],
                current["status"],
                _json(current["keyword_ids"]),
                ctx.user_id,
                article_id,
                ctx.workspace_id,
            ),
        ).fetchone()
    return _map_article(row) if row else None


def delete_article(ctx: CloudContext, article_id: str) -> None:
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        conn.execute("DELETE FROM articles WHERE id = %s AND workspace_id = %s", (article_id, ctx.workspace_id))


def _map_geo(row: dict[str, Any]) -> dict[str, Any]:
    item = {**row, "id": str(row["id"])}
    item["secondary_keywords"] = _loads(item.pop("secondary_keywords_json", []), [])
    item["brief"] = _loads(item.pop("brief_json", {}), {})
    item["title_options"] = _loads(item.pop("title_options_json", []), [])
    item["outline"] = _loads(item.pop("outline_json", []), [])
    item["draft_sections"] = _loads(item.pop("draft_sections_json", []), [])
    item["faq"] = _loads(item.pop("faq_json", []), [])
    item["suggestions"] = _loads(item.pop("suggestions_json", []), [])
    return item


def list_geo_drafts(ctx: CloudContext) -> list[dict[str, Any]]:
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        rows = conn.execute(
            "SELECT * FROM geo_article_drafts WHERE workspace_id = %s ORDER BY updated_at DESC",
            (ctx.workspace_id,),
        ).fetchall()
    return [_map_geo(row) for row in rows]


def get_geo_draft(ctx: CloudContext, draft_id: str) -> dict[str, Any] | None:
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        row = conn.execute(
            "SELECT * FROM geo_article_drafts WHERE id = %s AND workspace_id = %s",
            (draft_id, ctx.workspace_id),
        ).fetchone()
    return _map_geo(row) if row else None


def save_geo_draft(ctx: CloudContext, payload: dict[str, Any]) -> dict[str, Any]:
    timestamp = now_iso()
    record = {
        "id": payload.get("id"),
        "workspace_id": ctx.workspace_id,
        "title": payload["title"],
        "primary_keyword": payload["primary_keyword"],
        "secondary_keywords_json": _json(payload.get("secondary_keywords", [])),
        "audience": payload.get("audience", ""),
        "industry": payload.get("industry", ""),
        "target_market": payload.get("target_market", ""),
        "article_type": payload.get("article_type", ""),
        "tone": payload.get("tone", ""),
        "target_length": int(payload.get("target_length") or 1200),
        "brief_json": _json(payload.get("brief", {})),
        "title_options_json": _json(payload.get("title_options", [])),
        "meta_title": payload.get("meta_title", ""),
        "meta_description": payload.get("meta_description", ""),
        "outline_json": _json(payload.get("outline", [])),
        "draft_sections_json": _json(payload.get("draft_sections", [])),
        "faq_json": _json(payload.get("faq", [])),
        "suggestions_json": _json(payload.get("suggestions", [])),
        "provider": payload.get("provider", "system"),
        "status": payload.get("status", "draft"),
        "created_at": payload.get("created_at") or timestamp,
    }
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        if record["id"]:
            exists = conn.execute(
                "SELECT id FROM geo_article_drafts WHERE id = %s AND workspace_id = %s",
                (record["id"], ctx.workspace_id),
            ).fetchone()
        else:
            exists = None
        if exists:
            row = conn.execute(
                """
                UPDATE geo_article_drafts
                SET title=%(title)s, primary_keyword=%(primary_keyword)s, secondary_keywords_json=%(secondary_keywords_json)s::jsonb,
                    audience=%(audience)s, industry=%(industry)s, target_market=%(target_market)s, article_type=%(article_type)s,
                    tone=%(tone)s, target_length=%(target_length)s, brief_json=%(brief_json)s::jsonb,
                    title_options_json=%(title_options_json)s::jsonb, meta_title=%(meta_title)s, meta_description=%(meta_description)s,
                    outline_json=%(outline_json)s::jsonb, draft_sections_json=%(draft_sections_json)s::jsonb,
                    faq_json=%(faq_json)s::jsonb, suggestions_json=%(suggestions_json)s::jsonb, provider=%(provider)s,
                    status=%(status)s, updated_by=%(updated_by)s, updated_at=now()
                WHERE id=%(id)s AND workspace_id=%(workspace_id)s
                RETURNING *
                """,
                {**record, "updated_by": ctx.user_id},
            ).fetchone()
        else:
            row = conn.execute(
                """
                INSERT INTO geo_article_drafts (
                    workspace_id, title, primary_keyword, secondary_keywords_json, audience, industry, target_market,
                    article_type, tone, target_length, brief_json, title_options_json, meta_title, meta_description,
                    outline_json, draft_sections_json, faq_json, suggestions_json, provider, status, created_by, updated_by, created_at, updated_at
                )
                VALUES (
                    %(workspace_id)s, %(title)s, %(primary_keyword)s, %(secondary_keywords_json)s::jsonb, %(audience)s,
                    %(industry)s, %(target_market)s, %(article_type)s, %(tone)s, %(target_length)s, %(brief_json)s::jsonb,
                    %(title_options_json)s::jsonb, %(meta_title)s, %(meta_description)s, %(outline_json)s::jsonb,
                    %(draft_sections_json)s::jsonb, %(faq_json)s::jsonb, %(suggestions_json)s::jsonb, %(provider)s,
                    %(status)s, %(created_by)s, %(updated_by)s, %(created_at)s, now()
                )
                RETURNING *
                """,
                {**record, "created_by": ctx.user_id, "updated_by": ctx.user_id},
            ).fetchone()
    return _map_geo(row)


def get_settings(ctx: CloudContext) -> dict[str, Any]:
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        row = conn.execute(
            "SELECT settings_json FROM app_settings WHERE workspace_id = %s LIMIT 1",
            (ctx.workspace_id,),
        ).fetchone()
    return normalize_settings(row["settings_json"] if row else {})


def save_settings(ctx: CloudContext, patch: dict[str, Any]) -> dict[str, Any]:
    current = get_settings(ctx)
    for key, value in patch.items():
        if key in DEFAULT_SETTINGS and value is not None:
            current[key] = value
    with cloud_connect() as conn:
        _assert_member(conn, ctx)
        conn.execute(
            """
            INSERT INTO app_settings (workspace_id, settings_json, updated_by, updated_at)
            VALUES (%s, %s::jsonb, %s, now())
            ON CONFLICT (workspace_id)
            DO UPDATE SET settings_json = EXCLUDED.settings_json, updated_by = EXCLUDED.updated_by, updated_at = now()
            """,
            (ctx.workspace_id, _json(current), ctx.user_id),
        )
    return current


def dashboard_stats(ctx: CloudContext) -> dict[str, Any]:
    keywords = list_keywords(ctx)
    articles = list_articles(ctx)
    total = len(keywords)
    done = len([item for item in keywords if item["status"] == "done"])
    planned = len([item for item in keywords if item["status"] == "planned"])
    pending = len([item for item in keywords if item["status"] == "pending"])
    return {
        "keywords": {"total": total, "done": done, "planned": planned, "pending": pending, "coverage": round((done / total) * 100) if total else 0},
        "recent_articles": articles[:5],
        "pending_keywords": [item for item in keywords if item["status"] == "pending"][:8],
        "local_data": {"database_path": "cloud", "backup_dir": "supabase", "size_bytes": 0, "backup_count": 0, "table_counts": {"keywords": total, "articles": len(articles), "geo_article_drafts": len(list_geo_drafts(ctx))}},
        "modules": {"ai": False, "rank": False, "indexing": False},
    }


def import_snapshot(ctx: CloudContext, snapshot: dict[str, Any]) -> dict[str, Any]:
    result = {
        "imported": {"settings": 0, "keywords": 0, "articles": 0, "geo_article_drafts": 0},
        "skipped": 0,
        "failed": [],
    }
    if snapshot.get("app_settings"):
        save_settings(ctx, snapshot["app_settings"])
        result["imported"]["settings"] = 1
    for section, fn in (
        ("keywords", create_keyword),
        ("articles", create_article),
        ("geo_article_drafts", save_geo_draft),
    ):
        for item in snapshot.get(section, []):
            try:
                fn(ctx, item)
                result["imported"][section] += 1
            except Exception as exc:
                result["failed"].append({"section": section, "id": item.get("id", ""), "message": str(exc)})
    return result
