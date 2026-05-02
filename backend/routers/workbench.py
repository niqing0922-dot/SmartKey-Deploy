import re
from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from backend import db
from backend.data_context import get_data_context
from backend.observability import api_error, api_ok, log_domain_event
from backend.repositories import cloud
from backend.services.model_routing import platform_capabilities

router = APIRouter(prefix="/api/workbench", tags=["workbench"])


class WorkbenchDispatchPayload(BaseModel):
    prompt: str
    current_route: str = "/"
    language: str = "zh"


class ComposerActionPayload(BaseModel):
    keywords: list[str] = Field(default_factory=list)


class ComposerAction(BaseModel):
    type: str
    payload: ComposerActionPayload = Field(default_factory=ComposerActionPayload)


class WorkbenchExecutePayload(BaseModel):
    action: ComposerAction


LONGTAIL_MODIFIERS = [
    "supplier",
    "price",
    "manufacturer",
    "for factory automation",
    "for remote monitoring",
    "for smart manufacturing",
    "with 5G",
    "with VPN",
    "for DIN rail cabinet",
    "for IoT gateway",
    "comparison",
    "buying guide",
    "installation guide",
    "maintenance checklist",
    "for harsh environments",
    "for edge computing",
    "for PLC connection",
    "for SCADA systems",
    "for machine networking",
    "for industrial Ethernet",
]


def _is_zh(language: str) -> bool:
    return language.lower().startswith("zh")


def _model_name() -> str:
    capabilities = platform_capabilities()
    if capabilities["ai_available"]:
        return str(capabilities["active_ai_model_label"])
    return "Platform unavailable"


def _context_summary(request: Request, current_route: str, language: str) -> dict[str, Any]:
    _ = language
    data_ctx = get_data_context(request)
    stats = cloud.dashboard_stats(data_ctx.cloud) if data_ctx.is_cloud else db.dashboard_stats()
    articles = cloud.list_articles(data_ctx.cloud) if data_ctx.is_cloud else db.list_articles()
    return {
        "keyword_count": int(stats.get("keywords", {}).get("total") or 0),
        "article_count": len(articles),
        "pending_count": int(stats.get("keywords", {}).get("pending") or 0),
        "model_name": _model_name(),
        "current_page": current_route or "/",
    }


def _number_from_prompt(prompt: str, default: int = 10) -> int:
    match = re.search(r"(\d{1,3})", prompt)
    if not match:
        return default
    return max(1, min(int(match.group(1)), 100))


def _extract_topic(prompt: str) -> str:
    cleaned = re.sub(r"\d{1,3}", " ", prompt)
    cleaned = re.sub(
        r"(expand|generate|add|keywords?|long[- ]tail|for|please|help|me|with|ideas|list|of|write|article|draft|analyze|check|submit|indexing|configure|setup|open|rank|ranking|serp|position|matrix|distribution|bulk|import)",
        " ",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.;:!?")
    return cleaned or "industrial router"


def _generate_keywords(topic: str, count: int) -> list[str]:
    base = re.sub(r"\s+", " ", topic.strip().lower())
    generated: list[str] = []
    for modifier in LONGTAIL_MODIFIERS:
        candidate = f"{base} {modifier}".strip()
        if candidate not in generated:
            generated.append(candidate)
        if len(generated) >= count:
            break
    return generated


def _contains_any(text: str, tokens: tuple[str, ...]) -> bool:
    return any(token in text for token in tokens)


def _first_url(prompt: str) -> str | None:
    match = re.search(r"https?://[^\s\"'<>]+", prompt)
    return match.group(0) if match else None


def _dispatch_response(
    *,
    request: Request,
    intent: str,
    mode: str,
    reply: str,
    actions: list[dict[str, Any]],
    context_summary: dict[str, Any],
    requires_confirmation: bool = False,
    target_route: str = "/",
    prefill: dict[str, Any] | None = None,
    suggested_action: str | None = None,
    confidence: float = 0.0,
    reason: str = "",
):
    return api_ok(
        request,
        intent=intent,
        mode=mode,
        reply=reply,
        actions=actions,
        context_summary=context_summary,
        requires_confirmation=requires_confirmation,
        target_route=target_route,
        prefill=prefill or {},
        suggested_action=suggested_action,
        confidence=confidence,
        reason=reason,
    )


@router.get("/context")
def get_workbench_context(request: Request, current_route: str = "/", language: str = "zh"):
    return api_ok(request, context_summary=_context_summary(request, current_route, language))


@router.post("/dispatch")
def dispatch_workbench(payload: WorkbenchDispatchPayload, request: Request):
    prompt = payload.prompt.strip()
    text = prompt.lower()
    context = _context_summary(request, payload.current_route, payload.language)
    topic = _extract_topic(prompt)
    is_zh = _is_zh(payload.language)

    if _contains_any(text, ("expand", "long tail", "long-tail", "keyword ideas")):
        count = _number_from_prompt(prompt)
        return _dispatch_response(
            request=request,
            intent="keyword_expansion",
            mode="local_rules",
            reply="I will open the keyword library and prefill the expansion task.",
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/keywords",
            prefill={"keyword": topic, "quickKeyword": topic, "search": topic, "generated_keywords": _generate_keywords(topic, min(count, 20)), "type": "longtail", "status": "pending"},
            suggested_action="review_keyword_expansion",
            confidence=0.96,
            reason="Matched keyword expansion intent.",
        )

    if _contains_any(text, ("write an article", "product page", "blog post", "draft article")):
        return _dispatch_response(
            request=request,
            intent="geo_writer",
            mode="local_rules",
            reply="I will open GEO Writer and prefill the article brief.",
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/articles/geo-writer",
            prefill={"title": topic, "primary_keyword": topic, "secondary_keywords": topic, "industry": "Industrial IoT", "article_type": "blog", "target_length": 1000, "content_language": "zh" if is_zh else "en"},
            suggested_action="generate_draft",
            confidence=0.91,
            reason="Matched article writing intent.",
        )

    if _contains_any(text, ("analyze keyword", "keyword difficulty", "search intent")):
        return _dispatch_response(
            request=request,
            intent="keyword_analysis",
            mode="local_rules",
            reply="I will move this keyword into the analysis page.",
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/keywords/analyze",
            prefill={"keyword": topic, "context": topic},
            suggested_action="run_analysis",
            confidence=0.9,
            reason="Matched keyword analysis intent.",
        )

    if _contains_any(text, ("recommend keyword", "keyword recommend", "keyword ideas for article")):
        return _dispatch_response(
            request=request,
            intent="keyword_recommend",
            mode="local_rules",
            reply="I will open recommendations and prefill the topic.",
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/keywords/recommend",
            prefill={"title": topic, "context": topic, "count": 12},
            suggested_action="generate_recommendations",
            confidence=0.86,
            reason="Matched recommendation intent.",
        )

    if _contains_any(text, ("image plan", "hero image", "illustration", "visual")):
        return _dispatch_response(
            request=request,
            intent="image_planner",
            mode="local_rules",
            reply="I will move this task to the image planner.",
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/articles/image-planner",
            prefill={"title": topic, "content": prompt, "style": "Industrial photography", "count": 6},
            suggested_action="analyze_images",
            confidence=0.82,
            reason="Matched image planning intent.",
        )

    if _contains_any(text, ("bulk import", "import keywords")):
        return _dispatch_response(
            request=request,
            intent="bulk_import",
            mode="local_rules",
            reply="I will open the bulk import page.",
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/import",
            prefill={"text": "", "defaultType": "longtail"},
            suggested_action="paste_keywords",
            confidence=0.78,
            reason="Matched bulk import intent.",
        )

    if "matrix" in text or "distribution" in text:
        return _dispatch_response(
            request=request,
            intent="matrix_view",
            mode="local_rules",
            reply="I will switch to the matrix view.",
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/matrix",
            prefill={"focusType": "longtail", "query": topic},
            suggested_action="inspect_distribution",
            confidence=0.72,
            reason="Matched matrix or distribution intent.",
        )

    if _contains_any(text, ("rank", "ranking", "serp", "position")):
        return _dispatch_response(
            request=request,
            intent="rank_tracking",
            mode="local_rules",
            reply="I will route this to the rank tracker.",
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/rank-tracker",
            prefill={"keyword": topic},
            suggested_action="check_rank",
            confidence=0.83,
            reason="Matched rank tracking intent.",
        )

    if _contains_any(text, ("indexing", "indexed", "submit url", "check urls", "sitemap", "coverage")):
        found_url = _first_url(prompt)
        return _dispatch_response(
            request=request,
            intent="indexing",
            mode="local_rules",
            reply="I will open the indexing workspace and prepare the URLs.",
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/indexing",
            prefill={"urls": [found_url] if found_url else [], "action": "inspect"},
            suggested_action="inspect_urls",
            confidence=0.9,
            reason="Matched indexing intent.",
        )

    if _contains_any(text, ("settings", "configure", "setup")):
        return _dispatch_response(
            request=request,
            intent="settings",
            mode="local_rules",
            reply="I will open Settings.",
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/settings",
            prefill={},
            suggested_action="review_settings",
            confidence=0.8,
            reason="Matched settings intent.",
        )

    return _dispatch_response(
        request=request,
        intent="unknown",
        mode="local_rules",
        reply="I will keep us on the home page for now. Try a more specific request like expanding keywords or drafting an article.",
        actions=[],
        context_summary=context,
        requires_confirmation=True,
        target_route="/",
        prefill={},
        suggested_action="clarify_request",
        confidence=0.35,
        reason="No high-confidence rule matched the request.",
    )


@router.post("/execute")
def execute_workbench_action(payload: WorkbenchExecutePayload, request: Request):
    action = payload.action
    if action.type != "add_keywords":
        api_error(
            status_code=400,
            code="unsupported_composer_action",
            message=f"Unsupported Composer action: {action.type}",
            request=request,
            details={"action": action.type},
        )

    data_ctx = get_data_context(request)
    existing_items = cloud.list_keywords(data_ctx.cloud) if data_ctx.is_cloud else db.list_keywords()
    existing = {item["keyword"].strip().lower() for item in existing_items}
    created: list[dict[str, Any]] = []
    skipped: list[str] = []

    for raw_keyword in action.payload.keywords:
        keyword = re.sub(r"\s+", " ", str(raw_keyword).strip())
        if not keyword:
            continue
        key = keyword.lower()
        if key in existing:
            skipped.append(keyword)
            continue
        item_payload = {
            "keyword": keyword,
            "type": "longtail",
            "priority": "medium",
            "status": "pending",
            "notes": "Added by GlobalComposer",
        }
        item = cloud.create_keyword(data_ctx.cloud, item_payload) if data_ctx.is_cloud else db.create_keyword(item_payload)
        existing.add(key)
        created.append(item)

    log_domain_event("workbench.add_keywords", request=request, meta={"created": len(created), "skipped": len(skipped)})
    return api_ok(
        request,
        result_summary={
            "created_count": len(created),
            "skipped_count": len(skipped),
            "created_keywords": [item["keyword"] for item in created],
            "skipped_keywords": skipped,
        },
        created=created,
        skipped=skipped,
        requires_confirmation=False,
    )
