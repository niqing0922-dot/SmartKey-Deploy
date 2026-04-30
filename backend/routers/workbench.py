import re
from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from backend import db
from backend.data_context import get_data_context
from backend.observability import api_error, api_ok, log_domain_event
from backend.repositories import cloud
from backend.repositories.settings import get_settings

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


MODEL_NAMES = {
    "gemini": "Gemini 2.0 Flash",
    "minimax": "minimax 2.7-highspeed",
    "openai": "OpenAI",
    "anthropic": "Anthropic Claude",
    "deepseek": "DeepSeek",
    "qwen": "Qwen",
    "moonshot": "Moonshot",
    "grok": "xAI Grok",
    "cohere": "Cohere",
}

PROVIDER_FIELDS = {
    "gemini": ("gemini_enabled", "gemini_api_key"),
    "minimax": ("minimax_enabled", "minimax_api_key"),
    "openai": ("openai_enabled", "openai_api_key"),
    "anthropic": ("anthropic_enabled", "anthropic_api_key"),
    "deepseek": ("deepseek_enabled", "deepseek_api_key"),
    "qwen": ("qwen_enabled", "qwen_api_key"),
    "moonshot": ("moonshot_enabled", "moonshot_api_key"),
    "grok": ("grok_enabled", "grok_api_key"),
    "cohere": ("cohere_enabled", "cohere_api_key"),
}

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


ZH_STOP_WORDS_PATTERN = (
    r"(帮我|请|扩展|生成|添加|一批|条|个|长尾词|关键词|关键字|相关文章|列表|写一篇|写文章|草稿|分析|检查|提交|收录|配置|设置|打开)"
)


def _is_zh(language: str) -> bool:
    return language.lower().startswith("zh")


def _model_name(settings: dict[str, Any], language: str) -> str:
    for provider, (enabled_field, key_field) in PROVIDER_FIELDS.items():
        if settings.get(enabled_field) and settings.get(key_field):
            return MODEL_NAMES.get(provider, provider)
    default_provider = settings.get("default_ai_provider") or "minimax"
    if settings.get(f"{default_provider}_api_key"):
        return MODEL_NAMES.get(default_provider, default_provider)
    return "模型未配置" if _is_zh(language) else "Model not configured"


def _context_summary(request: Request, current_route: str, language: str) -> dict[str, Any]:
    data_ctx = get_data_context(request)
    stats = cloud.dashboard_stats(data_ctx.cloud) if data_ctx.is_cloud else db.dashboard_stats()
    articles = cloud.list_articles(data_ctx.cloud) if data_ctx.is_cloud else db.list_articles()
    settings = cloud.get_settings(data_ctx.cloud) if data_ctx.is_cloud else get_settings()
    return {
        "keyword_count": int(stats.get("keywords", {}).get("total") or 0),
        "article_count": len(articles),
        "pending_count": int(stats.get("keywords", {}).get("pending") or 0),
        "model_name": _model_name(settings, language),
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
        r"(expand|generate|add|keywords?|long[- ]tail|for|please|help|me|with|ideas|list|of|write|article|draft|analyze|check|submit|indexing|configure|setup|open)",
        " ",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(ZH_STOP_WORDS_PATTERN, " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.;:!?，。；：！？")
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


def _looks_like_keyword_expansion(prompt: str) -> bool:
    text = prompt.lower()
    return any(token in text for token in ("expand", "long tail", "long-tail", "keyword ideas")) or any(
        token in prompt for token in ("扩展", "长尾词", "关键词", "关键字")
    )


def _looks_like_settings(prompt: str) -> bool:
    text = prompt.lower()
    return any(token in text for token in ("openai key", "api key", "configure", "settings", "serpapi", "google credentials")) or any(
        token in prompt for token in ("配置", "设置", "密钥", "key", "凭证")
    )


def _looks_like_indexing(prompt: str) -> bool:
    text = prompt.lower()
    return any(token in text for token in ("indexing", "indexed", "submit url", "check urls", "sitemap", "coverage")) or any(
        token in prompt for token in ("收录", "索引", "提交 URL", "检查 URL", "网址")
    )


def _looks_like_rank(prompt: str) -> bool:
    text = prompt.lower()
    return any(token in text for token in ("rank", "ranking", "serp", "position")) or any(
        token in prompt for token in ("排名", "位次")
    )


def _looks_like_recommend(prompt: str) -> bool:
    text = prompt.lower()
    return any(token in text for token in ("recommend keyword", "keyword recommend", "keyword ideas for article")) or any(
        token in prompt for token in ("推荐关键词", "关键词推荐")
    )


def _looks_like_analyze(prompt: str) -> bool:
    text = prompt.lower()
    return any(token in text for token in ("analyze keyword", "keyword difficulty", "search intent")) or any(
        token in prompt for token in ("分析", "难度", "搜索意图")
    )


def _looks_like_article(prompt: str) -> bool:
    text = prompt.lower()
    return any(token in text for token in ("write an article", "product page", "blog post", "draft article")) or any(
        token in prompt for token in ("写一篇", "写文章", "文章", "产品页", "博客")
    )


def _looks_like_image_plan(prompt: str) -> bool:
    text = prompt.lower()
    return any(token in text for token in ("image plan", "hero image", "illustration", "visual")) or any(
        token in prompt for token in ("配图", "图片", "插图")
    )


def _looks_like_import(prompt: str) -> bool:
    text = prompt.lower()
    return any(token in text for token in ("bulk import", "import keywords")) or any(
        token in prompt for token in ("导入", "批量")
    )


def _looks_like_matrix(prompt: str) -> bool:
    text = prompt.lower()
    return "matrix" in text or "distribution" in text or "矩阵" in prompt or "分布" in prompt


def _first_url(prompt: str) -> str | None:
    match = re.search(r"https?://[^\s\"'<>]+", prompt)
    return match.group(0) if match else None


def _keyword_from_prompt(prompt: str) -> str:
    return _extract_topic(prompt)


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
    context = _context_summary(request, payload.current_route, payload.language)
    is_zh = _is_zh(payload.language)
    topic = _extract_topic(prompt)

    if _looks_like_keyword_expansion(prompt):
        count = _number_from_prompt(prompt)
        keywords = _generate_keywords(topic, min(count, 20))
        reply = (
            f"我会先带你去关键词库，并预填 {topic} 的扩展任务。"
            if is_zh
            else f"I'll take you to the keyword library and prefill an expansion task for {topic}."
        )
        return _dispatch_response(
            request=request,
            intent="keyword_expansion",
            mode="local_rules",
            reply=reply,
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/keywords",
            prefill={"keyword": topic, "quickKeyword": topic, "search": topic, "generated_keywords": keywords, "type": "longtail", "status": "pending"},
            suggested_action="review_keyword_expansion",
            confidence=0.96,
            reason="Matched keyword expansion intent with a direct keywords workspace prefill.",
        )

    if _looks_like_article(prompt):
        reply = "我会先进入 GEO Writer，并把文章主题预填好。" if is_zh else "I'll open GEO Writer and prefill the article brief."
        return _dispatch_response(
            request=request,
            intent="geo_writer",
            mode="local_rules",
            reply=reply,
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/articles/geo-writer",
            prefill={
                "title": topic,
                "primary_keyword": topic,
                "secondary_keywords": topic,
                "industry": "Industrial IoT",
                "article_type": "landing" if ("产品页" in prompt or "product page" in prompt.lower()) else "blog",
                "target_length": 1000,
                "content_language": "zh" if is_zh else "en",
            },
            suggested_action="generate_draft",
            confidence=0.91,
            reason="Matched article writing intent and routed to GEO Writer.",
        )

    if _looks_like_analyze(prompt):
        reply = "我会把这个关键词带到分析页。" if is_zh else "I'll move this keyword into the analysis page."
        return _dispatch_response(
            request=request,
            intent="keyword_analysis",
            mode="local_rules",
            reply=reply,
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/keywords/analyze",
            prefill={"keyword": _keyword_from_prompt(prompt), "context": topic},
            suggested_action="run_analysis",
            confidence=0.9,
            reason="Matched keyword analysis intent.",
        )

    if _looks_like_recommend(prompt):
        reply = "我会打开关键词推荐页，并把主题先填进去。" if is_zh else "I'll open recommendations and prefill the topic."
        return _dispatch_response(
            request=request,
            intent="keyword_recommend",
            mode="local_rules",
            reply=reply,
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/keywords/recommend",
            prefill={"title": topic, "context": topic, "count": 12},
            suggested_action="generate_recommendations",
            confidence=0.86,
            reason="Matched recommendation intent.",
        )

    if _looks_like_image_plan(prompt):
        reply = "我会把这个任务带到配图分析页。" if is_zh else "I'll move this task to the image planner."
        return _dispatch_response(
            request=request,
            intent="image_planner",
            mode="local_rules",
            reply=reply,
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/articles/image-planner",
            prefill={"title": topic, "content": prompt, "style": "Industrial photography", "count": 6},
            suggested_action="analyze_images",
            confidence=0.82,
            reason="Matched image planning intent.",
        )

    if _looks_like_import(prompt):
        reply = "我会先打开批量导入页。" if is_zh else "I'll open the bulk import page first."
        return _dispatch_response(
            request=request,
            intent="bulk_import",
            mode="local_rules",
            reply=reply,
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/import",
            prefill={"text": "", "defaultType": "longtail"},
            suggested_action="paste_keywords",
            confidence=0.78,
            reason="Matched bulk import intent.",
        )

    if _looks_like_matrix(prompt):
        reply = "我会切到矩阵视图，并带上筛选语境。" if is_zh else "I'll switch to the matrix view with the filter context."
        return _dispatch_response(
            request=request,
            intent="matrix_view",
            mode="local_rules",
            reply=reply,
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/matrix",
            prefill={"focusType": "longtail", "query": topic},
            suggested_action="inspect_distribution",
            confidence=0.72,
            reason="Matched matrix or distribution intent.",
        )

    if _looks_like_rank(prompt):
        reply = "我会把关键词带到排名追踪页。" if is_zh else "I'll route this to the rank tracker."
        return _dispatch_response(
            request=request,
            intent="rank_tracking",
            mode="local_rules",
            reply=reply,
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/rank-tracker",
            prefill={"keyword": _keyword_from_prompt(prompt), "provider": "serpapi"},
            suggested_action="check_rank",
            confidence=0.83,
            reason="Matched rank tracking intent.",
        )

    if _looks_like_indexing(prompt):
        found_url = _first_url(prompt)
        urls = [found_url] if found_url else []
        reply = "我会打开 Indexing 工作区，并先把 URL 准备好。" if is_zh else "I'll open the indexing workspace and prepare the URLs first."
        return _dispatch_response(
            request=request,
            intent="indexing",
            mode="local_rules",
            reply=reply,
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/indexing",
            prefill={"urls": urls, "action": "inspect"},
            suggested_action="inspect_urls",
            confidence=0.9,
            reason="Matched indexing intent.",
        )

    if _looks_like_settings(prompt):
        text = prompt.lower()
        section = "ai"
        provider = "openai" if "openai" in text else "minimax" if "minimax" in text else "serpapi" if "serpapi" in text else "indexing" if "google" in text else "ai"
        if provider == "serpapi":
            section = "seo"
        elif provider == "indexing":
            section = "indexing"
        reply = "我会带你去设置页，并定位到对应配置区。" if is_zh else "I'll take you to Settings and focus the right configuration section."
        return _dispatch_response(
            request=request,
            intent="settings",
            mode="local_rules",
            reply=reply,
            actions=[],
            context_summary=context,
            requires_confirmation=True,
            target_route="/settings",
            prefill={"section": section, "provider": provider},
            suggested_action="configure_settings",
            confidence=0.92,
            reason="Matched configuration intent.",
        )

    reply = (
        "我先留在首页。你可以更具体一点，比如“帮我扩展 10 个 industrial router 长尾词”或“写一篇 WR143 产品页文章”。"
        if is_zh
        else "I'll keep us on the AI home page for now. Try a more specific request like 'expand 10 industrial router long-tail keywords' or 'write a WR143 product page article'."
    )
    return _dispatch_response(
        request=request,
        intent="unknown",
        mode="local_rules",
        reply=reply,
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
        payload = {
            "keyword": keyword,
            "type": "longtail",
            "priority": "medium",
            "status": "pending",
            "notes": "Added by GlobalComposer",
        }
        item = cloud.create_keyword(data_ctx.cloud, payload) if data_ctx.is_cloud else db.create_keyword(payload)
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
