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
    """Core product routes require a cloud session when cloud mode is configured."""
    if not cloud_is_configured():
        return DataContext(mode="local")

    authorization = request.headers.get("authorization", "").strip()
    workspace_id = (request.headers.get("x-workspace-id") or request.query_params.get("workspace_id") or "").strip()
    wants_cloud = authorization.lower().startswith("bearer ") and bool(workspace_id)
    if not wants_cloud:
        api_error(
            status_code=401,
            code="cloud_session_required",
            message="A cloud session and active workspace are required for this route.",
            request=request,
        )
    return DataContext(mode="cloud", cloud=require_cloud_context(request))
