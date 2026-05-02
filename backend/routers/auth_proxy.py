import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from backend.config import get_app_settings
from backend.observability import api_error, api_ok, log_domain_event

router = APIRouter(prefix="/api/auth", tags=["auth"])


class AuthCredentialsPayload(BaseModel):
    email: str
    password: str = Field(min_length=6)


def _require_auth_config(request: Request) -> tuple[str, str]:
    settings = get_app_settings()
    base_url = str(settings.supabase_url or "").strip().rstrip("/")
    anon_key = str(settings.supabase_anon_key or "").strip()
    if not base_url or not anon_key:
        api_error(
            status_code=503,
            code="auth_not_configured",
            message="Supabase Auth is not configured for this app.",
            request=request,
        )
    return base_url, anon_key


def _read_upstream_error(response: httpx.Response) -> tuple[str, str]:
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    message = (
        payload.get("msg")
        or payload.get("message")
        or payload.get("error_description")
        or payload.get("error")
        or "Authentication request failed."
    )
    code = str(payload.get("error_code") or payload.get("code") or "auth_failed")
    return code, str(message)


def _supabase_auth_request(request: Request, path: str, payload: dict, event_name: str) -> dict:
    base_url, anon_key = _require_auth_config(request)
    try:
        response = httpx.post(
            f"{base_url}{path}",
            headers={
                "apikey": anon_key,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=20,
        )
    except httpx.RequestError as exc:
        log_domain_event(
            event_name,
            request=request,
            level="error",
            status_code=502,
            error_code="auth_upstream_unreachable",
            meta={"message": str(exc)},
        )
        api_error(
            status_code=502,
            code="auth_upstream_unreachable",
            message="The app could not reach Supabase Auth.",
            request=request,
            details={"reason": str(exc)},
            kind="system_failure",
        )

    if response.status_code >= 400:
        code, message = _read_upstream_error(response)
        log_domain_event(
            event_name,
            request=request,
            level="info" if response.status_code < 500 else "error",
            status_code=response.status_code,
            error_code=code,
            meta={"message": message},
        )
        api_error(
            status_code=response.status_code,
            code=code,
            message=message,
            request=request,
        )

    data = response.json()
    log_domain_event(event_name, request=request, meta={"email": payload.get("email", "")})
    return data


@router.post("/sign-in")
def sign_in(payload: AuthCredentialsPayload, request: Request):
    session = _supabase_auth_request(
        request,
        "/auth/v1/token?grant_type=password",
        {"email": payload.email, "password": payload.password},
        "auth.sign_in",
    )
    return api_ok(request, session=session)


@router.post("/sign-up")
def sign_up(payload: AuthCredentialsPayload, request: Request):
    session = _supabase_auth_request(
        request,
        "/auth/v1/signup",
        {"email": payload.email, "password": payload.password},
        "auth.sign_up",
    )
    return api_ok(request, session=session)
