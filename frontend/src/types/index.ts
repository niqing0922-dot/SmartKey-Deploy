export type KeywordStatus = 'pending' | 'planned' | 'done'
export type KeywordPriority = 'high' | 'medium' | 'low'
export type KeywordType = 'core' | 'longtail' | 'scenario' | 'persona' | 'qa' | 'competitor' | 'brand'
export type ArticleStatus = 'draft' | 'published'
export type AIProvider =
  | 'gemini'
  | 'minimax'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'qwen'
  | 'moonshot'
  | 'grok'
  | 'cohere'
export type ContentLanguage = 'zh' | 'en' | 'de' | 'es' | 'fr'

export interface KeywordItem {
  id: string
  keyword: string
  type: KeywordType
  priority: KeywordPriority
  status: KeywordStatus
  notes: string
  position: string
  related_article: string
  created_at: string
  updated_at: string
}

export interface ArticleItem {
  id: string
  title: string
  content: string
  status: ArticleStatus
  keyword_ids: string[]
  created_at: string
  updated_at: string
}

export interface DraftSection {
  heading: string
  content: string
}

export interface FAQItem {
  question: string
  answer: string
}

export interface GeoDraftItem {
  id: string
  title: string
  primary_keyword: string
  secondary_keywords: string[]
  audience: string
  industry: string
  target_market: string
  article_type: string
  tone: string
  target_length: number
  brief: Record<string, unknown>
  title_options: string[]
  meta_title: string
  meta_description: string
  outline: string[] | Array<{ heading?: string; bullets?: string[] }>
  draft_sections: DraftSection[]
  faq: FAQItem[]
  suggestions: string[]
  provider: AIProvider | 'system'
  status: string
  created_at: string
  updated_at: string
}

export interface SettingsItem {
  language: 'zh' | 'en'
  default_market: string
  default_tone: string
  default_article_type: string
  default_content_language: ContentLanguage
  rank_target_domain: string
  default_ai_provider: AIProvider
  default_seo_api?: 'serpapi' | 'dataforseo'
  gemini_enabled?: boolean
  minimax_enabled?: boolean
  openai_enabled?: boolean
  anthropic_enabled?: boolean
  deepseek_enabled?: boolean
  qwen_enabled?: boolean
  moonshot_enabled?: boolean
  grok_enabled?: boolean
  cohere_enabled?: boolean
  minimax_api_key: string
  gemini_api_key: string
  openai_api_key: string
  anthropic_api_key: string
  deepseek_api_key: string
  qwen_api_key: string
  moonshot_api_key: string
  grok_api_key: string
  cohere_api_key: string
  serpapi_key: string
  serpapi_enabled?: boolean
  dataforseo_api_login: string
  dataforseo_api_password: string
  dataforseo_enabled?: boolean
  python_path: string
  google_credentials_path: string
  indexing_enabled?: boolean
  gemini_api_key_configured?: boolean
  minimax_api_key_configured?: boolean
  openai_api_key_configured?: boolean
  anthropic_api_key_configured?: boolean
  deepseek_api_key_configured?: boolean
  qwen_api_key_configured?: boolean
  moonshot_api_key_configured?: boolean
  grok_api_key_configured?: boolean
  cohere_api_key_configured?: boolean
  serpapi_key_configured?: boolean
  dataforseo_api_login_configured?: boolean
  dataforseo_api_password_configured?: boolean
  google_credentials_path_configured?: boolean
  last_enabled_ai_provider?: AIProvider
  last_enabled_seo_provider?: 'serpapi' | 'dataforseo'
}

export interface ImagePlanItem {
  section: string
  reason: string
  image_type: string
  style: string
  prompt: string
}

export interface DashboardStats {
  keywords: {
    total: number
    done: number
    planned: number
    pending: number
    coverage: number
  }
  recent_articles: ArticleItem[]
  pending_keywords: KeywordItem[]
  local_data: {
    database_path: string
    backup_dir: string
    size_bytes: number
    backup_count: number
    table_counts: Record<string, number>
  }
  modules: {
    ai: boolean
    rank: boolean
    indexing: boolean
  }
}

export interface ApiErrorPayload {
  code: string
  message: string
  request_id: string
  kind?: 'user_actionable' | 'system_failure'
  details?: Record<string, unknown>
}

export interface ApiSuccessMeta {
  status: string
  request_id: string
}

export interface ReadinessStatus {
  status: 'ok' | 'degraded'
  checks: Record<string, { ok: boolean; details: string }>
}

export interface RuntimeDiagnostics {
  version: string
  database_path: string
  frontend_dist: string
  log_dir: string
  backend_log_path: string
  frontend_event_log_path: string
  readiness: ReadinessStatus
  metrics: {
    routes: Array<{
      route: string
      method: string
      count: number
      errors: number
      avg_duration_ms: number
      max_duration_ms: number
    }>
  }
  recent_errors: Array<Record<string, unknown>>
  recent_events: Array<Record<string, unknown>>
}
