from typing import Any

from backend.db import (
    DEFAULT_SETTINGS,
    _dumps,
    _loads,
    connect,
    make_id,
    normalize_settings,
    now_iso,
)
from backend.services.model_routing import platform_capabilities


def public_settings(settings: dict[str, Any], runtime_settings: dict[str, Any] | None = None) -> dict[str, Any]:
    _ = runtime_settings
    return {
        **normalize_settings(settings),
        **platform_capabilities(),
    }


def get_settings() -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT settings_json FROM app_settings LIMIT 1").fetchone()
    return normalize_settings(_loads(row["settings_json"] if row else None, {}))


def get_runtime_settings() -> dict[str, Any]:
    return public_settings(get_settings())


def save_settings(patch: dict[str, Any]) -> dict[str, Any]:
    current = get_settings()
    for key, value in patch.items():
        if key in DEFAULT_SETTINGS and value is not None:
            current[key] = value
    current = normalize_settings(current)
    with connect() as conn:
        row = conn.execute("SELECT id FROM app_settings LIMIT 1").fetchone()
        if row:
            conn.execute("UPDATE app_settings SET settings_json = ?, updated_at = ? WHERE id = ?", (_dumps(current), now_iso(), row["id"]))
        else:
            conn.execute(
                "INSERT INTO app_settings (id, settings_json, updated_at) VALUES (?, ?, ?)",
                (make_id(), _dumps(current), now_iso()),
            )
    return current
