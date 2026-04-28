from typing import Any

from backend.db import connect, make_id, now_iso


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
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO keywords (id, keyword, type, priority, status, notes, position, related_article, created_at, updated_at)
            VALUES (:id, :keyword, :type, :priority, :status, :notes, :position, :related_article, :created_at, :updated_at)
            """,
            record,
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
            """
            UPDATE keywords
            SET keyword=:keyword, type=:type, priority=:priority, status=:status, notes=:notes, position=:position, related_article=:related_article, updated_at=:updated_at
            WHERE id=:id
            """,
            current,
        )
    return current


def delete_keyword(keyword_id: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM keywords WHERE id = ?", (keyword_id,))
