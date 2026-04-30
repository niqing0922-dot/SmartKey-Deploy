from dataclasses import dataclass

from fastapi import Request

from backend.auth import CloudContext, cloud_is_configured, require_cloud_context
from backend.observability import api_error


@dataclass(frozen=True)
class DataContext:
    mode: str
    cloud: CloudContext | None = None

    @property
    def is_cloud(self) -> bool:
        return self.mode == "cloud" and self.cloud is not None


def get_data_context(request: Request) -> DataContext:
    """Use local SQLite by default; opt into cloud only with a token and workspace."""
    authorization = request.headers.get("authorization", "").strip()
    workspace_id = (request.headers.get("x-workspace-id") or request.query_params.get("workspace_id") or "").strip()
    wants_cloud = authorization.lower().startswith("bearer ") and bool(workspace_id)
    if not wants_cloud:
        return DataContext(mode="local")
    if not cloud_is_configured():
        api_error(
            status_code=503,
            code="cloud_not_configured",
            message="Cloud mode requires SMARTKEY_CLOUD_ENABLED, SMARTKEY_DATABASE_URL, and SMARTKEY_SUPABASE_JWT_SECRET.",
            request=request,
        )
    return DataContext(mode="cloud", cloud=require_cloud_context(request))
