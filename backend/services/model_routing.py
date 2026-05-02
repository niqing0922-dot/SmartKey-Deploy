import json
from typing import Any

from backend.config import get_app_settings

DEFAULT_ROUTE_MAP = {
    "keyword_recommend": {
        "provider": "minimax",
        "model": "MiniMax-M2.7-highspeed",
        "label": "MiniMax M2.7 Highspeed",
    },
    "keyword_analyze": {
        "provider": "minimax",
        "model": "MiniMax-M2.7-highspeed",
        "label": "MiniMax M2.7 Highspeed",
    },
    "geo_writer": {
        "provider": "minimax",
        "model": "MiniMax-M2.7-highspeed",
        "label": "MiniMax M2.7 Highspeed",
    },
    "indexing_url_extract": {
        "provider": "minimax",
        "model": "MiniMax-M2.7-highspeed",
        "label": "MiniMax M2.7 Highspeed",
    },
}

FEATURE_ALIASES = {
    "recommend": "keyword_recommend",
    "analyze": "keyword_analyze",
    "geo": "geo_writer",
    "indexing_url_extract": "indexing_url_extract",
}


def _parse_json_object(raw: str) -> dict[str, Any]:
    if not raw.strip():
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _normalize_route(route: dict[str, Any], fallback: dict[str, str]) -> dict[str, str]:
    provider = str(route.get("provider") or fallback["provider"]).strip().lower()
    model = str(route.get("model") or fallback["model"]).strip()
    label = str(route.get("label") or model or fallback["label"]).strip()
    return {
        "provider": provider,
        "model": model,
        "label": label,
    }


def canonical_feature_name(feature: str) -> str:
    return FEATURE_ALIASES.get(feature, feature)


def resolve_model_route(feature: str, workspace_id: str = "") -> dict[str, str]:
    settings = get_app_settings()
    feature_name = canonical_feature_name(feature)
    fallback = DEFAULT_ROUTE_MAP.get(feature_name, DEFAULT_ROUTE_MAP["geo_writer"])

    global_routes = _parse_json_object(settings.model_routes_json)
    route = global_routes.get(feature_name) if isinstance(global_routes.get(feature_name), dict) else {}

    if workspace_id:
        gray_routes = _parse_json_object(settings.gray_workspace_routes_json)
        workspace_routes = gray_routes.get(workspace_id) if isinstance(gray_routes.get(workspace_id), dict) else {}
        if isinstance(workspace_routes.get(feature_name), dict):
            route = workspace_routes[feature_name]

    return _normalize_route(route if isinstance(route, dict) else {}, fallback)


def platform_capabilities() -> dict[str, Any]:
    settings = get_app_settings()
    active_route = resolve_model_route("geo_writer")
    ai_available = settings.ai_enabled and any(settings.ai_provider_keys.values())
    rank_available = settings.rank_enabled and bool(settings.rank_provider_key)
    indexing_available = settings.indexing_enabled and settings.indexing_credentials_exists
    return {
        "ai_available": ai_available,
        "rank_available": rank_available,
        "indexing_available": indexing_available,
        "active_ai_model_label": active_route["label"],
        "active_ai_provider": active_route["provider"],
    }


def model_routing_snapshot(workspace_id: str = "") -> dict[str, Any]:
    settings = get_app_settings()
    previous_routes = _parse_json_object(settings.previous_model_routes_json)
    gray_routes = _parse_json_object(settings.gray_workspace_routes_json)
    return {
        "capabilities": platform_capabilities(),
        "routes": {
            feature: resolve_model_route(feature, workspace_id=workspace_id)
            for feature in DEFAULT_ROUTE_MAP
        },
        "previous_routes": previous_routes,
        "gray_workspace_count": len(gray_routes),
    }
