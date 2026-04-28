from typing import Any

from backend.db import _dumps, _loads, connect, make_id, now_iso


def _map_article(row: dict[str, Any]) -> dict[str, Any]:
    item = dict(row)
    keyword_ids_raw = item.pop("keyword_ids_json", item.pop("keyword_ids", "[]"))
    item["keyword_ids"] = _loads(keyword_ids_raw, [])
    return item


def list_articles() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM articles ORDER BY updated_at DESC").fetchall()
    return [_map_article(dict(row)) for row in rows]


def get_article(article_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM articles WHERE id = ?", (article_id,)).fetchone()
    return _map_article(dict(row)) if row else None


def create_article(payload: dict[str, Any]) -> dict[str, Any]:
    record = {
        "id": make_id(),
        "title": payload["title"].strip(),
        "content": payload.get("content") or "",
        "status": payload.get("status") or "draft",
        "keyword_ids": payload.get("keyword_ids") or [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO articles (id, title, content, status, keyword_ids_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record["id"],
                record["title"],
                record["content"],
                record["status"],
                _dumps(record["keyword_ids"]),
                record["created_at"],
                record["updated_at"],
            ),
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
    with connect() as conn:
        conn.execute(
            """
            UPDATE articles
            SET title = ?, content = ?, status = ?, keyword_ids_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                current["title"],
                current["content"],
                current["status"],
                _dumps(current["keyword_ids"]),
                current["updated_at"],
                article_id,
            ),
        )
    return current


def delete_article(article_id: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM articles WHERE id = ?", (article_id,))
