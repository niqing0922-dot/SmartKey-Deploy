from dataclasses import dataclass
from typing import Any

import jwt
from fastapi import Request

from backend.config import get_app_settings
from backend.observability import api_error


@dataclass(frozen=True)
class CloudContext:
    user_id: str
    workspace_id: str
    email: str = ""


def cloud_is_configured() -> bool:
    settings = get_app_settings()
    return bool(settings.cloud_enabled and settings.database_url and settings.supabase_jwt_secret)


def decode_supabase_token(token: str, request: Request) -> dict[str, Any]:
    settings = get_app_settings()
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": False},
        )
    except jwt.PyJWTError:
        api_error(status_code=401, code="invalid_token", message="Invalid or expired session.", request=request)


def get_bearer_token(request: Request) -> str:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        api_error(status_code=401, code="auth_required", message="Login is required for cloud workspaces.", request=request)
    return token.strip()


def require_cloud_user(request: Request) -> CloudContext:
    if not cloud_is_configured():
        api_error(
            status_code=503,
            code="cloud_not_configured",
            message="Cloud mode requires SMARTKEY_CLOUD_ENABLED, SMARTKEY_DATABASE_URL, and SMARTKEY_SUPABASE_JWT_SECRET.",
            request=request,
        )
    token = get_bearer_token(request)
    claims = decode_supabase_token(token, request)
    user_id = str(claims.get("sub") or "").strip()
    if not user_id:
        api_error(status_code=401, code="invalid_token", message="Session is missing a user id.", request=request)
    return CloudContext(user_id=user_id, workspace_id="", email=str(claims.get("email") or "").strip())


def require_cloud_context(request: Request) -> CloudContext:
    base = require_cloud_user(request)
    workspace_id = (request.headers.get("x-workspace-id") or request.query_params.get("workspace_id") or "").strip()
    if not workspace_id:
        api_error(status_code=400, code="workspace_required", message="A workspace id is required.", request=request)
    return CloudContext(user_id=base.user_id, workspace_id=workspace_id, email=base.email)
