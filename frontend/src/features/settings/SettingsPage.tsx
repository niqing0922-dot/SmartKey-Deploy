import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { platformApi, settingsApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'
import type { PlatformCapabilities, SettingsItem } from '@/types'

type DesktopUpdateState = {
  status: string
  version?: string
  message?: string
}

const defaultSettings: SettingsItem = {
  language: 'zh',
  default_market: 'Global / English',
  default_tone: 'Professional and clear',
  default_article_type: 'How-to guide',
  default_content_language: 'zh',
  ai_available: false,
  rank_available: false,
  indexing_available: false,
  active_ai_model_label: 'Unavailable',
}

const defaultPlatform: PlatformCapabilities = {
  ai_available: false,
  rank_available: false,
  indexing_available: false,
  active_ai_model_label: 'Unavailable',
}

const defaultUpdateState: DesktopUpdateState = {
  status: 'idle',
  version: '',
  message: '',
}

function ActionIcon({ kind }: { kind: 'update' | 'install' | 'exit' | 'workspace' }) {
  if (kind === 'workspace') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="15" rx="3" />
        <path d="M8 21h8" />
        <path d="M12 19v2" />
      </svg>
    )
  }
  if (kind === 'install') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v10" />
        <path d="m8 9 4 4 4-4" />
        <path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
      </svg>
    )
  }
  if (kind === 'exit') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

export function SettingsPage() {
  const auth = useAuth()
  const { language } = useI18n()
  const runtimeMode = window.smartKeyDesktop?.runtimeConfig?.mode || 'web'
  const runtimeApiBaseUrl = window.smartKeyDesktop?.runtimeConfig?.apiBaseUrl || ''

  const [settings, setSettings] = useState<SettingsItem>(auth.bootstrapData?.settings || defaultSettings)
  const [savedSettings, setSavedSettings] = useState<SettingsItem>(auth.bootstrapData?.settings || defaultSettings)
  const [platform, setPlatform] = useState<PlatformCapabilities>(auth.bootstrapData?.settings || defaultPlatform)
  const [updateState, setUpdateState] = useState<DesktopUpdateState>(defaultUpdateState)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [desktopMessage, setDesktopMessage] = useState('')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [installingUpdate, setInstallingUpdate] = useState(false)
  const [quittingApp, setQuittingApp] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [platformStatus, settingsData] = await Promise.all([
          platformApi.status(),
          auth.bootstrapData?.settings ? Promise.resolve(auth.bootstrapData.settings) : settingsApi.get(),
        ])
        setPlatform(platformStatus.capabilities)
        setSettings(settingsData)
        setSavedSettings(settingsData)
        setError('')
      } catch (issue: any) {
        setError(issue?.response?.data?.detail?.message || issue?.message || (language === 'zh' ? '加载设置失败。' : 'Failed to load settings.'))
      }
    }

    void loadData()
  }, [auth.bootstrapData, language])

  useEffect(() => {
    if (!window.smartKeyDesktop?.getUpdateState) return
    window.smartKeyDesktop.getUpdateState()
      .then((state) => {
        if (state) setUpdateState(state)
      })
      .catch(() => undefined)
  }, [])

  const isDirty = useMemo(() => JSON.stringify({
    language: settings.language,
    default_market: settings.default_market,
    default_tone: settings.default_tone,
    default_article_type: settings.default_article_type,
    default_content_language: settings.default_content_language,
  }) !== JSON.stringify({
    language: savedSettings.language,
    default_market: savedSettings.default_market,
    default_tone: savedSettings.default_tone,
    default_article_type: savedSettings.default_article_type,
    default_content_language: savedSettings.default_content_language,
  }), [savedSettings, settings])

  const setPartial = (patch: Partial<SettingsItem>) => {
    setSettings((current) => ({ ...current, ...patch }))
    setMessage('')
    setError('')
  }

  const save = async () => {
    try {
      const saved = await settingsApi.save({
        language: settings.language,
        default_market: settings.default_market,
        default_tone: settings.default_tone,
        default_article_type: settings.default_article_type,
        default_content_language: settings.default_content_language,
      })
      setSettings(saved)
      setSavedSettings(saved)
      auth.mutateBootstrapData((current) => current ? {
        ...current,
        settings: saved,
        sync_meta: { ...current.sync_meta, synced_at: new Date().toISOString() },
      } : current)
      setMessage(language === 'zh' ? '设置已保存。' : 'Settings saved.')
      setError('')
    } catch (issue: any) {
      setError(issue?.response?.data?.detail?.message || issue?.message || (language === 'zh' ? '保存设置失败。' : 'Failed to save settings.'))
    }
  }

  const syncDesktopState = (nextState: DesktopUpdateState, fallbackZh: string, fallbackEn: string) => {
    setUpdateState(nextState)
    setDesktopMessage(nextState.message || (language === 'zh' ? fallbackZh : fallbackEn))
  }

  const checkForUpdates = async () => {
    if (!window.smartKeyDesktop?.checkForUpdates) return
    setCheckingUpdate(true)
    setDesktopMessage('')
    try {
      const result = await window.smartKeyDesktop.checkForUpdates()
      syncDesktopState(result, '更新检查已完成。', 'Update check completed.')
    } catch (issue: any) {
      setDesktopMessage(issue?.message || (language === 'zh' ? '检查更新失败。' : 'Failed to check for updates.'))
    } finally {
      setCheckingUpdate(false)
    }
  }

  const installUpdate = async () => {
    if (!window.smartKeyDesktop?.installUpdate) return
    setInstallingUpdate(true)
    setDesktopMessage(language === 'zh' ? '正在退出并安装更新...' : 'Closing app to install the update...')
    try {
      const result = await window.smartKeyDesktop.installUpdate()
      syncDesktopState(result, '正在安装更新。', 'Installing update.')
    } catch (issue: any) {
      setInstallingUpdate(false)
      setDesktopMessage(issue?.message || (language === 'zh' ? '安装更新失败。' : 'Failed to install the update.'))
    }
  }

  const quitApp = async () => {
    if (!window.smartKeyDesktop?.quitApp) return
    setQuittingApp(true)
    setDesktopMessage(language === 'zh' ? '正在退出应用...' : 'Closing SmartKey...')
    try {
      await window.smartKeyDesktop.quitApp()
    } catch (issue: any) {
      setQuittingApp(false)
      setDesktopMessage(issue?.message || (language === 'zh' ? '退出应用失败。' : 'Failed to close SmartKey.'))
    }
  }

  const capabilityCards = [
    {
      label: 'AI',
      available: platform.ai_available,
      detail: platform.ai_available ? platform.active_ai_model_label : (language === 'zh' ? '平台未开放' : 'Unavailable'),
    },
    {
      label: 'Rank',
      available: platform.rank_available,
      detail: platform.rank_available ? (language === 'zh' ? '平台已启用' : 'Platform enabled') : (language === 'zh' ? '平台未开放' : 'Unavailable'),
    },
    {
      label: 'Indexing',
      available: platform.indexing_available,
      detail: platform.indexing_available ? (language === 'zh' ? '平台已启用' : 'Platform enabled') : (language === 'zh' ? '平台未开放' : 'Unavailable'),
    },
  ]

  const runtimeLabel = language === 'zh'
    ? runtimeMode === 'cloud-api'
      ? '云端 API'
      : runtimeMode === 'cloud-web'
        ? '云端网页'
        : runtimeMode === 'local'
          ? '本地内置'
          : '浏览器'
    : runtimeMode === 'cloud-api'
      ? 'Cloud API'
      : runtimeMode === 'cloud-web'
        ? 'Cloud Web'
        : runtimeMode === 'local'
          ? 'Local Built-in'
          : 'Browser'

  const updateSummary = updateState.status === 'downloaded'
    ? (language === 'zh'
      ? `可用更新 ${updateState.version || ''} 已下载，可立即安装。`
      : `Update ${updateState.version || ''} is downloaded and ready to install.`)
    : updateState.status === 'update-available'
      ? (language === 'zh'
        ? `发现更新 ${updateState.version || ''}，正在后台下载。`
        : `Update ${updateState.version || ''} was found and is downloading.`)
      : updateState.status === 'error'
        ? (language === 'zh' ? '更新检查失败，请稍后重试。' : 'Update check failed. Please try again.')
        : (language === 'zh'
          ? '桌面端会从 GitHub Releases 获取更新。'
          : 'Desktop updates are delivered through GitHub Releases.')

  return (
    <div id="page-settings" className="page page-active">
      <div className="page-header linear-page-header">
        <div>
          <div className="page-title">{language === 'zh' ? '设置' : 'Settings'}</div>
          <div className="page-desc">
            {language === 'zh'
              ? '这里只保留工作区偏好。AI、Rank 和 Indexing 的凭证与能力状态由平台统一托管。'
              : 'Only workspace preferences live here. AI, Rank, and Indexing are managed by the platform.'}
          </div>
        </div>
        <div className="linear-header-meta">
          <span>{language === 'zh' ? '云工作区模式' : 'Cloud workspace mode'}</span>
          <span>{isDirty ? (language === 'zh' ? '有未保存更改' : 'Unsaved changes') : (language === 'zh' ? '已同步' : 'Synced')}</span>
        </div>
      </div>

      <div className="page-body linear-workbench settings-linear-workbench">
        <section className="linear-left settings-side-panel">
          <div className="linear-panel-title">{language === 'zh' ? '平台能力' : 'Platform Capabilities'}</div>
          <div className="linear-metric-list settings-capability-list">
            {capabilityCards.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.available ? (language === 'zh' ? '可用' : 'Ready') : (language === 'zh' ? '未开放' : 'Unavailable')}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="linear-main settings-main-panel">
          {message ? <div className="alert alert-success">{message}</div> : null}
          {error ? <div className="alert alert-warn">{error}</div> : null}

          <div className="settings-provider-group">
            <div className="settings-group-head">
              <div className="linear-panel-title">{language === 'zh' ? '默认偏好' : 'Workspace Preferences'}</div>
            </div>
            <div className="form-grid settings-grid-2">
              <div className="field-block">
                <label>{language === 'zh' ? '界面语言' : 'Interface Language'}</label>
                <select value={settings.language} onChange={(event) => setPartial({ language: event.target.value as 'zh' | 'en' })}>
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="field-block">
                <label>{language === 'zh' ? '默认内容语言' : 'Default Content Language'}</label>
                <select value={settings.default_content_language} onChange={(event) => setPartial({ default_content_language: event.target.value as SettingsItem['default_content_language'] })}>
                  <option value="zh">ZH - 中文</option>
                  <option value="en">EN - English</option>
                  <option value="de">DE - Deutsch</option>
                  <option value="es">ES - Espanol</option>
                  <option value="fr">FR - Francais</option>
                </select>
              </div>
              <div className="field-block">
                <label>{language === 'zh' ? '默认市场' : 'Default Market'}</label>
                <input value={settings.default_market} onChange={(event) => setPartial({ default_market: event.target.value })} />
              </div>
              <div className="field-block">
                <label>{language === 'zh' ? '默认语气' : 'Default Tone'}</label>
                <input value={settings.default_tone} onChange={(event) => setPartial({ default_tone: event.target.value })} />
              </div>
              <div className="field-block">
                <label>{language === 'zh' ? '默认文章类型' : 'Default Article Type'}</label>
                <input value={settings.default_article_type} onChange={(event) => setPartial({ default_article_type: event.target.value })} />
              </div>
            </div>
          </div>

          <div className="settings-provider-group">
            <div className="settings-group-head">
              <div className="linear-panel-title">{language === 'zh' ? '平台状态' : 'Platform Status'}</div>
            </div>
            <div className="settings-group-subnote">
              {language === 'zh'
                ? '模型切换、凭证托管和能力开关都由平台后台控制，客户端只保留工作区偏好。'
                : 'Model routing, credentials, and capability switches are handled by the platform. The client only keeps workspace preferences.'}
            </div>
            <div className="linear-metric-list">
              <div>
                <span>{language === 'zh' ? '当前 AI 模型' : 'Active AI Model'}</span>
                <strong>{platform.active_ai_model_label}</strong>
              </div>
              <div>
                <span>AI</span>
                <strong>{platform.ai_available ? (language === 'zh' ? '平台已连接' : 'Platform ready') : (language === 'zh' ? '平台未开放' : 'Unavailable')}</strong>
              </div>
              <div>
                <span>Rank</span>
                <strong>{platform.rank_available ? (language === 'zh' ? '平台已连接' : 'Platform ready') : (language === 'zh' ? '平台未开放' : 'Unavailable')}</strong>
              </div>
              <div>
                <span>Indexing</span>
                <strong>{platform.indexing_available ? (language === 'zh' ? '平台已连接' : 'Platform ready') : (language === 'zh' ? '平台未开放' : 'Unavailable')}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="linear-right settings-right-panel">
          <div className="linear-panel-title">{language === 'zh' ? '工作区' : 'Workspace'}</div>
          <div className="settings-side-card">
            <div className="settings-side-card-head">
              <div className="settings-side-card-icon">
                <ActionIcon kind="workspace" />
              </div>
              <div>
                <strong>{auth.bootstrapData?.workspace?.name || '-'}</strong>
                <div className="muted-text">{auth.bootstrapData?.user?.email || '-'}</div>
              </div>
            </div>
            <div className="settings-workspace-meta">
              <div><span>{language === 'zh' ? '角色' : 'Role'}</span><strong>{auth.bootstrapData?.workspace?.role || '-'}</strong></div>
              <div><span>{language === 'zh' ? '运行模式' : 'Runtime'}</span><strong>{runtimeLabel}</strong></div>
            </div>
            {runtimeApiBaseUrl ? <div className="settings-runtime-url">{runtimeApiBaseUrl}</div> : null}
          </div>

          <div className="linear-panel-title" style={{ marginTop: 16 }}>{language === 'zh' ? '桌面操作' : 'Desktop Actions'}</div>
          <div className="settings-side-card settings-side-card-muted">
            <strong>{language === 'zh' ? '更新入口' : 'Update Entry'}</strong>
            <span className="muted-text">{desktopMessage || updateSummary}</span>
          </div>

          <div className="settings-desktop-actions">
            <button className="settings-action-card" type="button" onClick={() => void checkForUpdates()} disabled={!window.smartKeyDesktop?.checkForUpdates || checkingUpdate || installingUpdate || quittingApp}>
              <div className="settings-action-card-icon tone-update">
                <ActionIcon kind="update" />
              </div>
              <div className="settings-action-card-copy">
                <strong>{language === 'zh' ? '检查更新' : 'Check for Updates'}</strong>
                <span>{language === 'zh' ? '立即检查 GitHub Releases 上的新版本。' : 'Check GitHub Releases for a newer build.'}</span>
              </div>
            </button>

            <button className="settings-action-card" type="button" onClick={() => void installUpdate()} disabled={!window.smartKeyDesktop?.installUpdate || checkingUpdate || installingUpdate || quittingApp || (updateState.status !== 'downloaded' && updateState.status !== 'update-available')}>
              <div className="settings-action-card-icon tone-install">
                <ActionIcon kind="install" />
              </div>
              <div className="settings-action-card-copy">
                <strong>{language === 'zh' ? '安装更新' : 'Install Update'}</strong>
                <span>{language === 'zh' ? '检测到新版本后，重启并安装桌面更新。' : 'Restart and install the desktop update when available.'}</span>
              </div>
            </button>

            <button className="settings-action-card tone-exit" type="button" onClick={() => void quitApp()} disabled={!window.smartKeyDesktop?.quitApp || checkingUpdate || installingUpdate || quittingApp}>
              <div className="settings-action-card-icon tone-exit">
                <ActionIcon kind="exit" />
              </div>
              <div className="settings-action-card-copy">
                <strong>{language === 'zh' ? '退出应用' : 'Exit App'}</strong>
                <span>{language === 'zh' ? '关闭当前 SmartKey 桌面应用。' : 'Close the current SmartKey desktop app.'}</span>
              </div>
            </button>
          </div>

          <div className="settings-side-actions">
            <button className="btn" type="button" onClick={() => window.location.reload()}>
              {language === 'zh' ? '重新加载' : 'Reload'}
            </button>
            <button className="btn btn-primary" type="button" onClick={save} disabled={!isDirty}>
              {language === 'zh' ? '保存设置' : 'Save Settings'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
