import axios from 'axios'
import type { ApiErrorPayload, ArticleItem, DashboardStats, GeoDraftItem, ImagePlanItem, IndexingPrepareResult, KeywordItem, RankJobItem, RankResultItem, RankTemplatePreview, ReadinessStatus, RuntimeDiagnostics, SettingsItem, WorkspaceContext, WorkbenchDispatchRequest, WorkbenchDispatchResponse, WorkbenchExecuteRequest, WorkbenchExecuteResponse } from '@/types'

type ApiEnvelope<T> = {
  status: string
  request_id: string
} & T

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

const diagnosticsApiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

function buildRequestId() {
  return `web_${Math.random().toString(36).slice(2, 10)}`
}

api.interceptors.request.use((config) => {
  const requestId = buildRequestId()
  config.headers = config.headers ?? {}
  config.headers['x-request-id'] = requestId
  ;(config as any).metadata = { startedAt: performance.now(), requestId }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const responseData = error?.response?.data
    const payload: ApiErrorPayload | undefined = responseData?.error
    const metadata = error?.config?.metadata
    const durationMs = metadata?.startedAt ? Math.round(performance.now() - metadata.startedAt) : undefined
    if (payload) {
      error.response.data.detail = payload
      if (payload.details && typeof payload.details === 'object') {
        Object.assign(error.response.data.detail, payload.details)
      }
      error.userMessage = payload.message
      error.requestId = payload.request_id
    }
    if (import.meta.env.DEV) {
      console.warn('API request failed', {
        method: error?.config?.method,
        url: error?.config?.url,
        requestId: payload?.request_id || metadata?.requestId,
        durationMs,
        code: payload?.code,
        message: payload?.message || error.message,
      })
    }
    if (typeof window !== 'undefined' && error?.config?.url !== '/diagnostics/frontend-event') {
      void diagnosticsApiClient.post('/diagnostics/frontend-event', {
        level: 'error',
        event: 'frontend.api_error',
        route: error?.config?.url || '',
        details: {
          code: payload?.code || '',
          message: payload?.message || error.message,
          request_id: payload?.request_id || metadata?.requestId || '',
        },
        duration_ms: durationMs,
      }).catch(() => undefined)
    }
    return Promise.reject(error)
  },
)

export const dashboardApi = {
  async getStats() {
    const { data } = await api.get<ApiEnvelope<{ stats: DashboardStats }>>('/dashboard/stats')
    return data.stats
  },
}

export const keywordsApi = {
  async list(params?: Record<string, string>) {
    const { data } = await api.get<ApiEnvelope<{ items: KeywordItem[] }>>('/db/keywords', { params })
    return data.items
  },
  async create(payload: Partial<KeywordItem>) {
    const { data } = await api.post<ApiEnvelope<{ item: KeywordItem }>>('/db/keywords', payload)
    return data.item
  },
  async update(id: string, payload: Partial<KeywordItem>) {
    const { data } = await api.put<ApiEnvelope<{ item: KeywordItem }>>(`/db/keywords/${id}`, payload)
    return data.item
  },
  async remove(id: string) {
    await api.delete(`/db/keywords/${id}`)
  },
}

export const articlesApi = {
  async list() {
    const { data } = await api.get<ApiEnvelope<{ items: ArticleItem[] }>>('/db/articles')
    return data.items
  },
  async create(payload: Partial<ArticleItem>) {
    const { data } = await api.post<ApiEnvelope<{ item: ArticleItem }>>('/db/articles', payload)
    return data.item
  },
  async update(id: string, payload: Partial<ArticleItem>) {
    const { data } = await api.put<ApiEnvelope<{ item: ArticleItem }>>(`/db/articles/${id}`, payload)
    return data.item
  },
  async remove(id: string) {
    await api.delete(`/db/articles/${id}`)
  },
}

export const geoWriterApi = {
  async list() {
    const { data } = await api.get<ApiEnvelope<{ items: GeoDraftItem[] }>>('/geo-writer/drafts')
    return data.items
  },
  async generate(payload: Record<string, unknown>) {
    const { data } = await api.post<ApiEnvelope<{ item: GeoDraftItem }>>('/geo-writer/draft', payload)
    return data.item
  },
  async save(draftId: string) {
    const { data } = await api.post<ApiEnvelope<{ article: ArticleItem; draft: GeoDraftItem }>>('/geo-writer/save', { draft_id: draftId })
    return data
  },
  async exportMarkdown(draftId: string) {
    const { data } = await api.get(`/geo-writer/export/${draftId}.md`, { responseType: 'blob' })
    return data as Blob
  },
  async exportWord(draftId: string) {
    const { data } = await api.get(`/geo-writer/export/${draftId}.docx`, { responseType: 'blob' })
    return data as Blob
  },
}

export const aiApi = {
  async recommend(payload: Record<string, unknown>) {
    const { data } = await api.post('/ai/recommend', { payload })
    return data
  },
  async analyze(payload: Record<string, unknown>) {
    const { data } = await api.post('/ai/analyze', { payload })
    return data
  },
  async chat(payload: Record<string, unknown>) {
    const { data } = await api.post('/ai/chat', { payload })
    return data
  },
  async imagePlan(payload: Record<string, unknown>) {
    const { data } = await api.post<{ provider: string; status: string; items: ImagePlanItem[] }>('/ai/image-plan', { payload })
    return data
  },
  async indexingUrlExtract(payload: { text: string; filename?: string }) {
    const { data } = await api.post<{ provider: string; status: string; urls: string[]; notes?: string }>('/ai/indexing-url-extract', { payload })
    return data
  },
}

export const settingsApi = {
  async get() {
    const { data } = await api.get<ApiEnvelope<{ settings: SettingsItem }>>('/settings')
    return data.settings
  },
  async save(payload: Partial<SettingsItem> & { last_enabled_ai_provider?: string; last_enabled_seo_provider?: string }) {
    const { data } = await api.post<ApiEnvelope<{ settings: SettingsItem }>>('/settings', payload)
    return data.settings
  },
}

export const localDataApi = {
  async summary() {
    const { data } = await api.get<ApiEnvelope<{ summary: any }>>('/local-data/summary')
    return data.summary
  },
  async exportSnapshot() {
    const { data } = await api.get<ApiEnvelope<{ snapshot: unknown }>>('/local-data/export')
    return data.snapshot
  },
  async backups() {
    const { data } = await api.get<ApiEnvelope<{ items: Array<Record<string, unknown>> }>>('/local-data/backups')
    return data.items
  },
  async backup() {
    const { data } = await api.post('/local-data/backup')
    return data
  },
  async importSnapshot(snapshot: unknown) {
    const { data } = await api.post('/local-data/import', { snapshot })
    return data
  },
  async reset(mode: 'content' | 'all') {
    const { data } = await api.post('/local-data/reset', { mode })
    return data
  },
}

export const rankApi = {
  async jobs() {
    const { data } = await api.get<ApiEnvelope<{ items: RankJobItem[]; message?: string }>>('/rank/jobs')
    return data
  },
  async previewTemplate(payload: { file: { filename: string; content_base64: string } }) {
    const { data } = await api.post<ApiEnvelope<{ preview: RankTemplatePreview }>>('/rank/template/preview', payload)
    return data
  },
  async run(payload: {
    mode: 'batch_template_run' | 'single_keyword_check'
    template_file?: { filename: string; content_base64: string }
    keywords?: string[]
    domain?: string
    provider?: string
    max_pages?: number
    results_per_request?: number
    hl?: string
    gl?: string
    source?: string
  }) {
    const { data } = await api.post('/rank/jobs/run', payload)
    return data
  },
  async results(jobId: string) {
    const { data } = await api.get<ApiEnvelope<{ item: RankJobItem; items: RankResultItem[] }>>(`/rank/jobs/${jobId}/results`)
    return data
  },
  artifactUrl(jobId: string, kind: 'xlsx' | 'csv') {
    return `/api/rank/jobs/${jobId}/artifacts/${kind}`
  },
}

export const indexingApi = {
  async jobs() {
    const { data } = await api.get('/indexing/jobs')
    return data
  },
  async prepare(payload: { sources: Array<{ filename: string; content: string }> }) {
    const { data } = await api.post<ApiEnvelope<IndexingPrepareResult>>('/indexing/prepare', payload)
    return data
  },
  async run(payload: {
    action: 'inspect' | 'submit'
    site_url?: string
    urls?: string[]
    url_file_path?: string
    max_pages?: number
    crawl_delay?: number
    check_delay?: number
    credentials_path?: string
    submission_type?: 'URL_UPDATED' | 'URL_DELETED'
    max_retries?: number
  }) {
    const { data } = await api.post('/indexing/jobs/run', payload)
    return data
  },
  async pages(jobId: string) {
    const { data } = await api.get(`/indexing/jobs/${jobId}/pages`)
    return data
  },
}

export const diagnosticsApi = {
  async readiness() {
    const { data } = await api.get<ApiEnvelope<{ readiness: ReadinessStatus }>>('/health/readiness')
    return data.readiness
  },
  async runtime() {
    const { data } = await api.get<ApiEnvelope<{ runtime: RuntimeDiagnostics }>>('/diagnostics/runtime')
    return data.runtime
  },
}

export const workbenchApi = {
  async context(params: { current_route: string; language: string }) {
    const { data } = await api.get<ApiEnvelope<WorkspaceContext>>('/workbench/context', {
      params: { current_route: params.current_route, language: params.language },
    })
    return data.context_summary
  },
  async dispatch(payload: WorkbenchDispatchRequest) {
    const { data } = await api.post<ApiEnvelope<WorkbenchDispatchResponse>>('/workbench/dispatch', payload)
    return data
  },
  async execute(payload: WorkbenchExecuteRequest) {
    const { data } = await api.post<ApiEnvelope<WorkbenchExecuteResponse>>('/workbench/execute', payload)
    return data
  },
}

export default api
