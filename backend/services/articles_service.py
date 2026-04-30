from typing import Any

from backend.repositories.articles import (
    create_article,
    delete_article,
    get_article,
    list_articles,
    update_article,
)


def list_article_items() -> list[dict[str, Any]]:
    return list_articles()


def get_article_item(article_id: str) -> dict[str, Any] | None:
    return get_article(article_id)


def create_article_item(payload: dict[str, Any]) -> dict[str, Any]:
    return create_article(payload)


def update_article_item(article_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    return update_article(article_id, payload)


def delete_article_item(article_id: str) -> None:
    delete_article(article_id)
