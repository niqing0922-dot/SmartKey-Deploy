from typing import Any

from backend.repositories.keywords import (
    create_keyword,
    delete_keyword,
    get_keyword,
    list_keywords,
    update_keyword,
)


def list_keyword_items(filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    return list_keywords(filters)


def get_keyword_item(keyword_id: str) -> dict[str, Any] | None:
    return get_keyword(keyword_id)


def create_keyword_item(payload: dict[str, Any]) -> dict[str, Any]:
    return create_keyword(payload)


def update_keyword_item(keyword_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    return update_keyword(keyword_id, payload)


def delete_keyword_item(keyword_id: str) -> None:
    delete_keyword(keyword_id)
