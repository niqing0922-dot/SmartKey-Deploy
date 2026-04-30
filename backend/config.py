from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    app_version: str = "2.0.0"
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
    )
    cors_allow_credentials: bool = True
    ai_http_timeout_seconds: int = 60
    indexing_runner_timeout_seconds: int = 900
    rank_target_domain: str = ""
    python_path: str = ""
    google_credentials_path: str = ""
    minimax_api_key: str = ""
    gemini_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    deepseek_api_key: str = ""
    qwen_api_key: str = ""
    moonshot_api_key: str = ""
    grok_api_key: str = ""
    cohere_api_key: str = ""
    serpapi_key: str = ""
    dataforseo_api_login: str = ""
    dataforseo_api_password: str = ""
    cloud_enabled: bool = False
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""
    database_url: str = ""

    model_config = SettingsConfigDict(env_prefix="SMARTKEY_", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        raw = (self.cors_origins or "").strip()
        if not raw:
            return []
        if raw == "*":
            return ["*"]
        return [item.strip() for item in raw.split(",") if item.strip()]

    @property
    def integration_overrides(self) -> dict[str, str]:
        keys = (
            "rank_target_domain",
            "python_path",
            "google_credentials_path",
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
        )
        overrides: dict[str, str] = {}
        for key in keys:
            value = str(getattr(self, key, "") or "").strip()
            if value:
                overrides[key] = value
        return overrides


@lru_cache(maxsize=1)
def get_app_settings() -> AppSettings:
    return AppSettings()
