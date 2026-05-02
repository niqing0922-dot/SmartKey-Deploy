from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_GOOGLE_CREDENTIALS_PATH = PROJECT_ROOT / "tools" / "google-indexing" / "config" / "service_account.json"


class AppSettings(BaseSettings):
    app_version: str = "2.0.0"
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,file://,null"
    )
    cors_allow_credentials: bool = True
    ai_http_timeout_seconds: int = 60
    indexing_runner_timeout_seconds: int = 900
    rank_target_domain: str = ""
    python_path: str = ""
    google_credentials_path: str = ""
    ai_enabled: bool = True
    rank_enabled: bool = True
    indexing_enabled: bool = True
    ai_default_provider: str = "minimax"
    ai_default_model: str = "MiniMax-M2.7-highspeed"
    model_routes_json: str = ""
    gray_workspace_routes_json: str = ""
    previous_model_routes_json: str = ""
    desktop_update_owner: str = ""
    desktop_update_repo: str = ""
    minimax_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("SMARTKEY_MINIMAX_API_KEY", "MINIMAX_API_KEY"),
    )
    gemini_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    deepseek_api_key: str = ""
    qwen_api_key: str = ""
    moonshot_api_key: str = ""
    grok_api_key: str = ""
    cohere_api_key: str = ""
    serpapi_key: str = Field(
        default="",
        validation_alias=AliasChoices("SMARTKEY_SERPAPI_KEY", "SERPAPI_API_KEY"),
    )
    dataforseo_api_login: str = ""
    dataforseo_api_password: str = ""
    cloud_enabled: bool = False
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""
    database_url: str = ""

    model_config = SettingsConfigDict(
        env_prefix="SMARTKEY_",
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        raw = (self.cors_origins or "").strip()
        if not raw:
            return []
        if raw == "*":
            return ["*"]
        return [item.strip() for item in raw.split(",") if item.strip()]

    @property
    def ai_provider_keys(self) -> dict[str, str]:
        keys = (
            "minimax_api_key",
            "gemini_api_key",
            "openai_api_key",
            "anthropic_api_key",
            "deepseek_api_key",
            "qwen_api_key",
            "moonshot_api_key",
            "grok_api_key",
            "cohere_api_key",
        )
        overrides: dict[str, str] = {}
        for key in keys:
            value = str(getattr(self, key, "") or "").strip()
            if value:
                overrides[key] = value
        return overrides

    @property
    def rank_provider_key(self) -> str:
        return str(self.serpapi_key or "").strip()

    @property
    def indexing_service_account_path(self) -> str:
        configured_path = str(self.google_credentials_path or "").strip()
        if configured_path:
            return configured_path
        return str(DEFAULT_GOOGLE_CREDENTIALS_PATH)

    @property
    def platform_python_command(self) -> str:
        return str(self.python_path or "").strip()

    @property
    def indexing_credentials_exists(self) -> bool:
        path = self.indexing_service_account_path
        return bool(path) and Path(path).exists()

    @property
    def github_update_configured(self) -> bool:
        return bool(self.desktop_update_owner.strip() and self.desktop_update_repo.strip())


@lru_cache(maxsize=1)
def get_app_settings() -> AppSettings:
    return AppSettings()
