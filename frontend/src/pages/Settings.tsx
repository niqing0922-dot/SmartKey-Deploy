import { useEffect, useMemo, useState } from 'react'
import { settingsApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'
import type { AIProvider, SettingsItem } from '@/types'
import { AI_PROVIDER_GUIDES, INDEXING_GUIDE, SERPAPI_GUIDE } from '@/pages/settingsGuideConfig'

const defaultSettings: SettingsItem = {
  language: 'zh',
  default_market: 'Global / English',
  default_tone: 'Professional and clear',
  default_article_type: 'How-to guide',
  default_content_language: 'zh',
  rank_target_domain: '',
  default_ai_provider: 'minimax',
  default_seo_api: 'serpapi',
  gemini_enabled: false,
  minimax_enabled: false,
  openai_enabled: false,
  anthropic_enabled: false,
  deepseek_enabled: false,
  qwen_enabled: false,
  moonshot_enabled: false,
  grok_enabled: false,
  cohere_enabled: false,
  minimax_api_key: '',
  gemini_api_key: '',
  openai_api_key: '',
  anthropic_api_key: '',
  deepseek_api_key: '',
  qwen_api_key: '',
  moonshot_api_key: '',
  grok_api_key: '',
  cohere_api_key: '',
  serpapi_key: '',
  serpapi_enabled: false,
  dataforseo_api_login: '',
  dataforseo_api_password: '',
  dataforseo_enabled: false,
  python_path: '',
  google_credentials_path: '',
  indexing_enabled: false,
  gemini_api_key_configured: false,
  minimax_api_key_configured: false,
  openai_api_key_configured: false,
  anthropic_api_key_configured: false,
  deepseek_api_key_configured: false,
  qwen_api_key_configured: false,
  moonshot_api_key_configured: false,
  grok_api_key_configured: false,
  cohere_api_key_configured: false,
  serpapi_key_configured: false,
  dataforseo_api_login_configured: false,
  dataforseo_api_password_configured: false,
  google_credentials_path_configured: false,
}

type AiEnabledKey =
  | 'gemini_enabled'
  | 'minimax_enabled'
  | 'openai_enabled'
  | 'anthropic_enabled'
  | 'deepseek_enabled'
  | 'qwen_enabled'
  | 'moonshot_enabled'
  | 'grok_enabled'
  | 'cohere_enabled'

type AiKeyField =
  | 'gemini_api_key'
  | 'minimax_api_key'
  | 'openai_api_key'
  | 'anthropic_api_key'
  | 'deepseek_api_key'
  | 'qwen_api_key'
  | 'moonshot_api_key'
  | 'grok_api_key'
  | 'cohere_api_key'

type AiConfiguredField =
  | 'gemini_api_key_configured'
  | 'minimax_api_key_configured'
  | 'openai_api_key_configured'
  | 'anthropic_api_key_configured'
  | 'deepseek_api_key_configured'
  | 'qwen_api_key_configured'
  | 'moonshot_api_key_configured'
  | 'grok_api_key_configured'
  | 'cohere_api_key_configured'

type AiProviderMeta = {
  id: AIProvider
  label: string
  keyField: AiKeyField
  configuredField: AiConfiguredField
  enabledField: AiEnabledKey
}

const AI_PROVIDERS: AiProviderMeta[] = [
  { id: 'gemini', label: 'Google Gemini', keyField: 'gemini_api_key', configuredField: 'gemini_api_key_configured', enabledField: 'gemini_enabled' },
  { id: 'minimax', label: 'MiniMax', keyField: 'minimax_api_key', configuredField: 'minimax_api_key_configured', enabledField: 'minimax_enabled' },
  { id: 'openai', label: 'OpenAI', keyField: 'openai_api_key', configuredField: 'openai_api_key_configured', enabledField: 'openai_enabled' },
  { id: 'anthropic', label: 'Anthropic Claude', keyField: 'anthropic_api_key', configuredField: 'anthropic_api_key_configured', enabledField: 'anthropic_enabled' },
  { id: 'deepseek', label: 'DeepSeek', keyField: 'deepseek_api_key', configuredField: 'deepseek_api_key_configured', enabledField: 'deepseek_enabled' },
  { id: 'qwen', label: 'Qwen', keyField: 'qwen_api_key', configuredField: 'qwen_api_key_configured', enabledField: 'qwen_enabled' },
  { id: 'moonshot', label: 'Moonshot', keyField: 'moonshot_api_key', configuredField: 'moonshot_api_key_configured', enabledField: 'moonshot_enabled' },
  { id: 'grok', label: 'xAI Grok', keyField: 'grok_api_key', configuredField: 'grok_api_key_configured', enabledField: 'grok_enabled' },
  { id: 'cohere', label: 'Cohere', keyField: 'cohere_api_key', configuredField: 'cohere_api_key_configured', enabledField: 'cohere_enabled' },
]

const AI_LABEL: Record<AIProvider, string> = AI_PROVIDERS.reduce((acc, item) => {
  acc[item.id] = item.label
  return acc
}, {} as Record<AIProvider, string>)

function getInitialEnabledAi(settings: SettingsItem): AIProvider | undefined {
  const active = AI_PROVIDERS.find((item) => Boolean(settings[item.enabledField]))
  return active?.id
}

export function SettingsPage() {
  const { language, t } = useI18n()
  const copy = t.settings
  const common = t.common

  const [settings, setSettings] = useState<SettingsItem>(defaultSettings)
  const [savedSettings, setSavedSettings] = useState<SettingsItem>(defaultSettings)
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [expandedGuide, setExpandedGuide] = useState<Record<string, boolean>>({})
  const [lastEnabledAiProvider, setLastEnabledAiProvider] = useState<AIProvider | undefined>('minimax')

  const loadSettings = async () => {
    const data = await settingsApi.get()
    setSettings(data)
    setSavedSettings(data)
    setMessage('')
    setLastEnabledAiProvider(getInitialEnabledAi(data) ?? data.default_ai_provider)
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const setPartial = (patch: Partial<SettingsItem>) => {
    setSettings((current) => ({ ...current, ...patch }))
    setMessage('')
  }

  const setAiEnabled = (providerId: AIProvider, checked: boolean) => {
    const provider = AI_PROVIDERS.find((item) => item.id === providerId)
    if (!provider) return
    if (!checked) {
      setPartial({ [provider.enabledField]: false } as Partial<SettingsItem>)
      return
    }
    const nextPatch: Partial<SettingsItem> = {}
    AI_PROVIDERS.forEach((item) => {
      nextPatch[item.enabledField] = item.id === providerId
    })
    setLastEnabledAiProvider(providerId)
    setPartial(nextPatch)
  }

  const isConfiguredAi = (item: AiProviderMeta) => Boolean(settings[item.configuredField] || settings[item.keyField])
  const enabledAiProviders = useMemo(() => AI_PROVIDERS.filter((item) => Boolean(settings[item.enabledField])).map((item) => item.id), [settings])
  const activeAiProvider = enabledAiProviders.length === 1 ? enabledAiProviders[0] : undefined
  const aiReadyCount = AI_PROVIDERS.filter((item) => isConfiguredAi(item)).length

  const serpConfigured = Boolean(settings.serpapi_key_configured || settings.serpapi_key)
  const serpEnabled = Boolean(settings.serpapi_enabled)
  const rankDomainSet = Boolean(settings.rank_target_domain?.trim())
  const rankReady = serpConfigured && rankDomainSet
  const indexingConfigured = Boolean(settings.google_credentials_path_configured || settings.google_credentials_path)

  const enabledButUnconfiguredAi = AI_PROVIDERS
    .filter((item) => Boolean(settings[item.enabledField]))
    .filter((item) => !isConfiguredAi(item))
    .map((item) => item.id)

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings)

  const save = async () => {
    const saved = await settingsApi.save({
      ...settings,
      dataforseo_enabled: false,
      default_seo_api: 'serpapi',
      last_enabled_ai_provider: lastEnabledAiProvider,
      last_enabled_seo_provider: 'serpapi',
    })
    setSettings(saved)
    setSavedSettings(saved)
    setMessage(copy.saved)
  }

  const toggleGuide = (id: string) => {
    setExpandedGuide((current) => ({ ...current, [id]: !current[id] }))
  }

  const aiWarningLabels = enabledButUnconfiguredAi.map((id) => AI_LABEL[id]).join(' / ')

  return (
    <div id="page-settings" className="page page-active">
      <div className="page-header linear-page-header">
        <div>
          <div className="page-title">{copy.title}</div>
          <div className="page-desc">{copy.desc}</div>
        </div>
        <div className="linear-header-meta">
          <span>{language === 'zh' ? '配置中心' : 'Configuration Center'}</span>
        </div>
      </div>

      <div className="page-body linear-workbench settings-linear-workbench settings-provider-workbench">
        <section className="linear-left">
          <div className="linear-panel-title">{language === 'zh' ? '配置状态' : 'Status'}</div>
          <div className="linear-metric-list">
            <div>
              <span>{language === 'zh' ? 'AI 可生效模型' : 'AI Ready Models'}</span>
              <strong>{aiReadyCount} / {AI_PROVIDERS.length}</strong>
            </div>
            <div>
              <span>{language === 'zh' ? '当前生效模型' : 'Active Model'}</span>
              <strong>{activeAiProvider ? AI_LABEL[activeAiProvider] : language === 'zh' ? '未启用' : 'None'}</strong>
            </div>
            <div>
              <span>{language === 'zh' ? 'Rank Tracking' : 'Rank Tracking'}</span>
              <strong>{rankReady ? 'OK' : (language === 'zh' ? '待配置' : 'Needs Setup')}</strong>
            </div>
            <div>
              <span>{language === 'zh' ? '未保存更改' : 'Unsaved Changes'}</span>
              <strong>{isDirty ? (language === 'zh' ? '有' : 'Yes') : (language === 'zh' ? '无' : 'No')}</strong>
            </div>
          </div>
        </section>

        <section className="linear-main settings-main-panel">
          <div className="settings-status-strip">
            <span className="status-chip ready">{language === 'zh' ? `可生效模型 ${aiReadyCount}` : `Ready Models ${aiReadyCount}`}</span>
            <span className="status-chip muted">
              {language === 'zh' ? '当前生效模型：' : 'Active Model: '}
              {activeAiProvider ? AI_LABEL[activeAiProvider] : language === 'zh' ? '未启用' : 'None'}
            </span>
            <span className={rankReady ? 'status-chip ready' : 'status-chip warn'}>
              Rank: {rankReady ? (language === 'zh' ? '已就绪' : 'Ready') : (language === 'zh' ? '待配置' : 'Needs Setup')}
            </span>
            <span className={isDirty ? 'status-chip warn' : 'status-chip muted'}>
              {isDirty ? (language === 'zh' ? '未保存更改' : 'Unsaved Changes') : (language === 'zh' ? '已保存' : 'Saved')}
            </span>
          </div>

          {message ? <div className="alert alert-success">{message}</div> : null}

          {enabledButUnconfiguredAi.length > 0 ? (
            <div className="alert alert-warn">
              {language === 'zh' ? `以下 AI 供应商已启用但未配置 Key：${aiWarningLabels}` : `Enabled AI provider(s) without API key: ${aiWarningLabels}`}
            </div>
          ) : null}

          <div className="settings-provider-group">
            <div className="settings-group-head">
              <div className="linear-panel-title">{language === 'zh' ? '默认偏好' : 'Default Preference'}</div>
            </div>
            <div className="settings-group-subnote">
              {language === 'zh' ? '默认值不会覆盖下方启用状态。' : 'Defaults do not override enabled states below.'}
            </div>
            <div className="settings-switch-stack">
              <div className="settings-switch-item">
                <div>
                  <div className="settings-switch-title">{language === 'zh' ? '默认 AI 供应商' : 'Default AI Provider'}</div>
                </div>
                <div className="settings-pill-row">
                  {AI_PROVIDERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={settings.default_ai_provider === item.id ? 'settings-pill active' : 'settings-pill'}
                      onClick={() => setPartial({ default_ai_provider: item.id })}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-switch-item">
                <div>
                  <div className="settings-switch-title">{language === 'zh' ? '默认 SEO API' : 'Default SEO API'}</div>
                  <div className="settings-switch-sub">SerpAPI</div>
                </div>
                <span className="status-chip ready">SerpAPI</span>
              </div>
            </div>
          </div>

          <div className="settings-provider-group">
            <div className="settings-group-head">
              <div className="linear-panel-title">{language === 'zh' ? 'AI 供应商' : 'AI Providers'}</div>
              <span className="settings-current-badge">
                {language === 'zh' ? '当前生效：' : 'Active: '}
                {activeAiProvider ? AI_LABEL[activeAiProvider] : language === 'zh' ? '未启用' : 'None'}
              </span>
            </div>
            <div className="form-grid settings-grid-2">
              {AI_PROVIDERS.map((item) => {
                const configured = isConfiguredAi(item)
                const enabled = Boolean(settings[item.enabledField])
                const guide = AI_PROVIDER_GUIDES[item.id]
                const guideId = `ai-${item.id}`
                return (
                  <div className="field-block settings-provider-card" key={item.id}>
                    <div className="settings-provider-head">
                      <label>{item.label}</label>
                      <label className="sw" title={language === 'zh' ? '启用 / 停用' : 'Enable / Disable'}>
                        <input type="checkbox" checked={enabled} onChange={(event) => setAiEnabled(item.id, event.target.checked)} />
                        <span className="sw-track"></span>
                        <span className="sw-knob"></span>
                      </label>
                    </div>
                    <div className="key-input-wrap">
                      <input
                        type={visible[item.keyField] ? 'text' : 'password'}
                        value={String(settings[item.keyField] || '')}
                        onChange={(event) => setPartial({ [item.keyField]: event.target.value } as Partial<SettingsItem>)}
                      />
                      <button
                        className="key-toggle"
                        type="button"
                        title={copy.toggleMask}
                        onClick={() => setVisible((current) => ({ ...current, [item.keyField]: !current[item.keyField] }))}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </div>
                    <div className="settings-dual-status">
                      <span className={configured ? 'status-chip ready' : 'status-chip muted'}>
                        {configured ? copy.effectiveReady : copy.notConfigured}
                      </span>
                      <span className={enabled ? 'status-chip ready' : 'status-chip muted'}>
                        {enabled ? copy.enabled : copy.disabled}
                      </span>
                    </div>
                    <button className="settings-guide-toggle" type="button" onClick={() => toggleGuide(guideId)}>
                      {copy.howToGetApi}
                    </button>
                    {expandedGuide[guideId] ? (
                      <div className="settings-guide-panel">
                        <a href={guide.officialUrl} target="_blank" rel="noreferrer" className="settings-guide-link">
                          {copy.openOfficialSite}
                        </a>
                        <div className="settings-guide-note">{language === 'zh' ? '仅前往官方站点' : 'Official site only'}</div>
                        <div className="settings-guide-list-title">{copy.steps}</div>
                        <ol>
                          {guide.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                        <div className="settings-guide-note">Key: {guide.keyHint}</div>
                        <div className="settings-guide-note">{copy.notes}: {guide.billingNote}</div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="settings-provider-group">
            <div className="settings-group-head">
              <div className="linear-panel-title">SEO（SerpAPI）</div>
              <span className="settings-current-badge">{rankReady ? (language === 'zh' ? 'Rank 已就绪' : 'Rank Ready') : (language === 'zh' ? 'Rank 待配置' : 'Rank Needs Setup')}</span>
            </div>
            <div className="field-block settings-provider-card">
              <div className="settings-provider-head">
                <label>SerpAPI</label>
                <label className="sw" title={language === 'zh' ? '启用 / 停用' : 'Enable / Disable'}>
                  <input type="checkbox" checked={serpEnabled} onChange={(event) => setPartial({ serpapi_enabled: event.target.checked })} />
                  <span className="sw-track"></span>
                  <span className="sw-knob"></span>
                </label>
              </div>
              <div className="key-input-wrap">
                <input
                  type={visible.serpapi_key ? 'text' : 'password'}
                  value={settings.serpapi_key || ''}
                  onChange={(event) => setPartial({ serpapi_key: event.target.value })}
                />
                <button
                  className="key-toggle"
                  type="button"
                  title={copy.toggleMask}
                  onClick={() => setVisible((current) => ({ ...current, serpapi_key: !current.serpapi_key }))}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
              <div className="field-block" style={{ marginTop: 8 }}>
                <label>{language === 'zh' ? '默认目标域名（Rank）' : 'Default target domain (Rank)'}</label>
                <input
                  value={settings.rank_target_domain || ''}
                  onChange={(event) => setPartial({ rank_target_domain: event.target.value })}
                  placeholder={language === 'zh' ? '例如：waveteliot.com' : 'e.g. waveteliot.com'}
                />
              </div>
              <div className="settings-dual-status">
                <span className={serpConfigured ? 'status-chip ready' : 'status-chip muted'}>
                  {serpConfigured ? copy.effectiveReady : copy.notConfigured}
                </span>
                <span className={serpEnabled ? 'status-chip ready' : 'status-chip muted'}>
                  {serpEnabled ? copy.enabled : copy.disabled}
                </span>
                <span className={rankReady ? 'status-chip ready' : 'status-chip warn'}>
                  {rankReady ? (language === 'zh' ? 'Rank 已就绪' : 'Rank Ready') : (language === 'zh' ? '缺少域名或 API' : 'Missing domain or API')}
                </span>
              </div>
              <button className="settings-guide-toggle" type="button" onClick={() => toggleGuide('seo-serpapi')}>
                {copy.howToGetApi}
              </button>
              {expandedGuide['seo-serpapi'] ? (
                <div className="settings-guide-panel">
                  <a href={SERPAPI_GUIDE.officialUrl} target="_blank" rel="noreferrer" className="settings-guide-link">
                    {copy.openOfficialSite}
                  </a>
                  <div className="settings-guide-note">{language === 'zh' ? '仅前往官方站点' : 'Official site only'}</div>
                  <div className="settings-guide-list-title">{copy.steps}</div>
                  <ol>
                    {SERPAPI_GUIDE.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <div className="settings-guide-note">Key: {SERPAPI_GUIDE.keyHint}</div>
                  <div className="settings-guide-note">{copy.notes}: {SERPAPI_GUIDE.billingNote}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="settings-provider-group">
            <div className="linear-panel-title">Indexing</div>
            <div className="form-grid settings-grid-2">
              <div className="field-block">
                <label>{copy.language}</label>
                <select value={settings.language} onChange={(event) => setPartial({ language: event.target.value as 'zh' | 'en' })}>
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="field-block">
                <label>{copy.defaultContentLanguage}</label>
                <select value={settings.default_content_language} onChange={(event) => setPartial({ default_content_language: event.target.value as 'zh' | 'en' | 'de' | 'es' | 'fr' })}>
                  <option value="zh">ZH - 中文</option>
                  <option value="en">EN - English</option>
                  <option value="de">DE - Deutsch</option>
                  <option value="es">ES - Espanol</option>
                  <option value="fr">FR - Francais</option>
                </select>
              </div>
              <div className="field-block"><label>{copy.defaultMarket}</label><input value={settings.default_market} onChange={(event) => setPartial({ default_market: event.target.value })} /></div>
              <div className="field-block"><label>{copy.defaultTone}</label><input value={settings.default_tone} onChange={(event) => setPartial({ default_tone: event.target.value })} /></div>
              <div className="field-block"><label>{copy.defaultArticleType}</label><input value={settings.default_article_type} onChange={(event) => setPartial({ default_article_type: event.target.value })} /></div>
              <div className="field-block"><label>{copy.pythonPath}</label><input value={settings.python_path} onChange={(event) => setPartial({ python_path: event.target.value })} /></div>
              <div className="field-block">
                <div className="settings-provider-head">
                  <label>{copy.googleCreds}</label>
                  <label className="sw" title={language === 'zh' ? '启用 / 停用' : 'Enable / Disable'}>
                    <input type="checkbox" checked={Boolean(settings.indexing_enabled)} onChange={(event) => setPartial({ indexing_enabled: event.target.checked })} />
                    <span className="sw-track"></span>
                    <span className="sw-knob"></span>
                  </label>
                </div>
                <input value={settings.google_credentials_path} onChange={(event) => setPartial({ google_credentials_path: event.target.value })} />
                <div className="settings-dual-status">
                  <span className={indexingConfigured ? 'status-chip ready' : 'status-chip muted'}>
                    {indexingConfigured ? copy.effectiveReady : copy.notConfigured}
                  </span>
                  <span className={settings.indexing_enabled ? 'status-chip ready' : 'status-chip muted'}>
                    {settings.indexing_enabled ? copy.enabled : copy.disabled}
                  </span>
                </div>
                <button className="settings-guide-toggle" type="button" onClick={() => toggleGuide('indexing-guide')}>
                  {copy.indexingCredentialsGuideTitle}
                </button>
                {expandedGuide['indexing-guide'] ? (
                  <div className="settings-guide-panel">
                    <a href={INDEXING_GUIDE.officialUrl} target="_blank" rel="noreferrer" className="settings-guide-link">
                      {copy.openOfficialSite}
                    </a>
                    <div className="settings-guide-note">{language === 'zh' ? '仅前往官方站点' : 'Official site only'}</div>
                    <div className="settings-guide-list-title">{copy.steps}</div>
                    <ol>
                      {INDEXING_GUIDE.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="linear-right">
          <div className="linear-panel-title">{language === 'zh' ? '操作' : 'Actions'}</div>
          <div className="linear-inspector-grid">
            <button className="btn" data-testid="settings-reload" type="button" onClick={loadSettings}>{common.reload}</button>
            <button className="btn btn-primary" type="button" onClick={save} data-testid="settings-save">{common.save}</button>
            <div className={isDirty ? 'settings-dirty-tip' : 'muted-text'}>
              {isDirty ? (language === 'zh' ? '● 未保存更改' : '● Unsaved changes') : (language === 'zh' ? '配置已同步' : 'Settings synced')}
            </div>
            {message ? <div className="muted-text">{message}</div> : null}
          </div>
        </section>
      </div>
    </div>
  )
}
