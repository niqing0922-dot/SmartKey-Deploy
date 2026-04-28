from typing import Any

from backend.db import _dumps, _loads, connect, filter_record, make_id, now_iso


def _map_geo_row(row: dict[str, Any]) -> dict[str, Any]:
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
    return [_map_geo_row(dict(row)) for row in rows]


def get_geo_draft(draft_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM geo_article_drafts WHERE id = ?", (draft_id,)).fetchone()
    return _map_geo_row(dict(row)) if row else None


def save_geo_draft(payload: dict[str, Any]) -> dict[str, Any]:
    timestamp = now_iso()
    record = {
        "id": payload.get("id") or make_id(),
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
