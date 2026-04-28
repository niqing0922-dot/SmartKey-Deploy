from typing import Any

from backend.config import get_app_settings
from backend.db import (
    AI_ENABLED_KEYS,
    AI_PROVIDER_TO_ENABLED_KEY,
    DEFAULT_SETTINGS,
    SEO_ENABLED_KEYS,
    SEO_PROVIDER_TO_ENABLED_KEY,
    SENSITIVE_SETTINGS_KEYS,
    _dumps,
    _loads,
    connect,
    make_id,
    normalize_domain,
    normalize_settings,
    now_iso,
)


def _runtime_overrides() -> dict[str, str]:
    settings = get_app_settings()
    overrides = settings.integration_overrides
    if "rank_target_domain" in overrides:
        overrides["rank_target_domain"] = normalize_domain(overrides["rank_target_domain"])
    return overrides


def public_settings(settings: dict[str, Any], runtime_settings: dict[str, Any] | None = None) -> dict[str, Any]:
    effective = runtime_settings or settings
    safe = {**settings}
    for key in SENSITIVE_SETTINGS_KEYS:
        safe[key] = ""
    safe["gemini_api_key_configured"] = bool(effective.get("gemini_api_key"))
    safe["minimax_api_key_configured"] = bool(effective.get("minimax_api_key"))
    safe["openai_api_key_configured"] = bool(effective.get("openai_api_key"))
    safe["anthropic_api_key_configured"] = bool(effective.get("anthropic_api_key"))
    safe["deepseek_api_key_configured"] = bool(effective.get("deepseek_api_key"))
    safe["qwen_api_key_configured"] = bool(effective.get("qwen_api_key"))
    safe["moonshot_api_key_configured"] = bool(effective.get("moonshot_api_key"))
    safe["grok_api_key_configured"] = bool(effective.get("grok_api_key"))
    safe["cohere_api_key_configured"] = bool(effective.get("cohere_api_key"))
    safe["serpapi_key_configured"] = bool(effective.get("serpapi_key"))
    safe["dataforseo_api_login_configured"] = bool(effective.get("dataforseo_api_login"))
    safe["dataforseo_api_password_configured"] = bool(effective.get("dataforseo_api_password"))
    safe["google_credentials_path_configured"] = bool(effective.get("google_credentials_path"))
    return safe


def get_settings() -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT settings_json FROM app_settings LIMIT 1").fetchone()
    return normalize_settings(_loads(row["settings_json"] if row else None, {}))


def get_runtime_settings() -> dict[str, Any]:
    runtime = get_settings()
    runtime.update(_runtime_overrides())
    return runtime


def save_settings(patch: dict[str, Any]) -> dict[str, Any]:
    last_enabled_ai_provider = patch.pop("last_enabled_ai_provider", None)
    last_enabled_seo_provider = patch.pop("last_enabled_seo_provider", None)
    current = get_settings()
    for key, value in patch.items():
        if key not in DEFAULT_SETTINGS:
            continue
        if key in SENSITIVE_SETTINGS_KEYS:
            if value is None or (isinstance(value, str) and not value.strip()):
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
            conn.execute(
                "INSERT INTO app_settings (id, settings_json, updated_at) VALUES (?, ?, ?)",
                (make_id(), _dumps(current), now_iso()),
            )
    return current
