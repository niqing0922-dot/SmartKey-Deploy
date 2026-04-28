import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { articlesApi, keywordsApi } from '@/services/api'
import { setUiLanguage, useUiLanguage } from '@/hooks/useUiLanguage'
import { messages } from '@/i18n/messages'
import { recordRecentRoute } from '@/lib/workbenchDrafts'
import { SmartKeyLogo } from '@/components/brand/SmartKeyLogo'

type NavBadgeKey = 'keywords' | 'articles' | 'rank'
type NavGroup = {
  label: string
  items: Array<{
    to: string
    label: string
    icon: any
    badgeKey?: NavBadgeKey
  }>
}

function AppLogo() {
  return <SmartKeyLogo className="sidebar-logo-icon" compact />
}

function GridIcon() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
}

function SparkIcon() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /><path d="M5 15l.9 2.1L8 18l-2.1.9L5 21l-.9-2.1L2 18l2.1-.9L5 15Z" /></svg>
}

function MatrixIcon() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>
}

function RecommendIcon() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
}

function AnalyzeIcon() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
}

function WriterIcon() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
}

function ImageIcon() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
}

function RankIcon() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
}

function LibraryIcon() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
}

function ArticlesIcon() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
}

function ImportIcon() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>
}

function SettingsIcon() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.07.06a2 2 0 0 1-2.84 2.84l-.06-.07a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1.03 1.55V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1.02-1.55 1.7 1.7 0 0 0-1.82.33l-.06.07a2 2 0 1 1-2.84-2.84l.07-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.64 8.5a1.7 1.7 0 0 0-.33-1.82l-.07-.06a2 2 0 1 1 2.84-2.84l.06.07a1.7 1.7 0 0 0 1.82.33h.01a1.7 1.7 0 0 0 1.02-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.82-.33l.06-.07a2 2 0 1 1 2.84 2.84l-.07.06a1.7 1.7 0 0 0-.33 1.82v.01a1.7 1.7 0 0 0 1.55 1.02H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03z" /></svg>
}

function DatabaseIcon() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>
}

function IndexingIcon() {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" /><path d="M8 11h6M11 8v6" /></svg>
}

function navTestId(path: string) {
  const key = path === '/' ? 'ai-home' : path.replace(/^\//, '').replace(/[\/]+/g, '.')
  return `nav.${key}`
}

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const language = useUiLanguage()
  const copy = messages[language].shell
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const defaultDarkMigrated = window.localStorage.getItem('smartkey.theme.defaultDark.v1') === '1'
    const stored = window.localStorage.getItem('smartkey.theme')
    if (!defaultDarkMigrated) return 'dark'
    return stored === 'light' ? 'light' : 'dark'
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [counts, setCounts] = useState({ keywords: 0, articles: 0, rank: 0 })
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [paletteIndex, setPaletteIndex] = useState(0)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('smartkey.theme', theme)
    window.localStorage.setItem('smartkey.theme.defaultDark.v1', '1')
  }, [theme])

  useEffect(() => {
    const saved = window.localStorage.getItem('smartkey.sidebar.collapsed')
    if (saved === '1') setSidebarCollapsed(true)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('smartkey.sidebar.collapsed', sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    document.title = copy.documentTitle
  }, [language, copy.documentTitle])

  useEffect(() => {
    recordRecentRoute(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    Promise.allSettled([keywordsApi.list(), articlesApi.list()]).then(([kwResult, artResult]) => {
      setCounts({
        keywords: kwResult.status === 'fulfilled' ? kwResult.value.length : 0,
        articles: artResult.status === 'fulfilled' ? artResult.value.length : 0,
        rank: 0,
      })
    })
  }, [])

  const navGroups = useMemo<NavGroup[]>(() => [
    {
      label: language === 'zh' ? '核心工作流' : 'Core Workflow',
      items: [
        { to: '/', label: language === 'zh' ? '首页' : 'Home', icon: <SparkIcon /> },
        { to: '/dashboard', label: copy.nav.dashboard, icon: <GridIcon /> },
        { to: '/keywords', label: copy.nav.keywords, icon: <LibraryIcon />, badgeKey: 'keywords' },
        { to: '/articles', label: copy.nav.articles, icon: <ArticlesIcon />, badgeKey: 'articles' },
        { to: '/articles/geo-writer', label: copy.nav.geoWriter, icon: <WriterIcon /> },
        { to: '/matrix', label: copy.nav.matrix, icon: <MatrixIcon /> },
      ],
    },
    {
      label: language === 'zh' ? 'AI 辅助' : 'AI Assist',
      items: [
        { to: '/keywords/recommend', label: copy.nav.recommend, icon: <RecommendIcon /> },
        { to: '/keywords/analyze', label: copy.nav.analyze, icon: <AnalyzeIcon /> },
        { to: '/articles/image-planner', label: copy.nav.imagePlanner, icon: <ImageIcon /> },
      ],
    },
    {
      label: language === 'zh' ? '可选模块' : 'Optional Modules',
      items: [
        { to: '/import', label: copy.nav.import, icon: <ImportIcon /> },
        { to: '/rank-tracker', label: copy.nav.rank, icon: <RankIcon />, badgeKey: 'rank' },
        { to: '/indexing', label: 'Google Indexing', icon: <IndexingIcon /> },
        { to: '/local-data', label: language === 'zh' ? '本地数据' : 'Local Data', icon: <DatabaseIcon /> },
        { to: '/settings', label: language === 'zh' ? '设置' : 'Settings', icon: <SettingsIcon /> },
      ],
    },
  ], [copy, language])

  const quickNavItems = useMemo(
    () => navGroups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label }))),
    [navGroups],
  )

  const filteredQuickNavItems = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase()
    if (!q) return quickNavItems
    return quickNavItems.filter((item) => `${item.label} ${item.group} ${item.to}`.toLowerCase().includes(q))
  }, [paletteQuery, quickNavItems])

  useEffect(() => {
    setPaletteIndex(0)
  }, [paletteQuery, paletteOpen])

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault()
        setPaletteOpen((prev) => !prev)
        return
      }
      if (!paletteOpen) return
      if (key === 'escape') {
        event.preventDefault()
        setPaletteOpen(false)
        return
      }
      if (key === 'arrowdown') {
        event.preventDefault()
        setPaletteIndex((prev) => Math.min(prev + 1, Math.max(filteredQuickNavItems.length - 1, 0)))
        return
      }
      if (key === 'arrowup') {
        event.preventDefault()
        setPaletteIndex((prev) => Math.max(prev - 1, 0))
        return
      }
      if (key === 'enter') {
        const item = filteredQuickNavItems[paletteIndex]
        if (!item) return
        event.preventDefault()
        navigate(item.to)
        setPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [filteredQuickNavItems, navigate, paletteIndex, paletteOpen])

  const footerLangClass = useMemo(
    () => ({
      zh: language === 'zh' ? 'lang-opt active' : 'lang-opt',
      en: language === 'en' ? 'lang-opt active' : 'lang-opt',
    }),
    [language],
  )

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar" id="sidebar" data-testid="shell.sidebar">
        <div className="sidebar-logo">
          {!sidebarCollapsed ? <AppLogo /> : null}
          {!sidebarCollapsed ? (
            <div className="sidebar-logo-copy">
              <div className="sidebar-logo-text">SmartKey</div>
              <div className="sidebar-logo-sub">Linear SEO Workbench</div>
            </div>
          ) : null}
          <button
            className={`sidebar-collapse-btn ${sidebarCollapsed ? 'is-collapsed-toggle' : ''}`}
            data-testid="shell.sidebar-toggle"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? (language === 'zh' ? '展开侧边栏' : 'Expand sidebar') : (language === 'zh' ? '折叠侧边栏' : 'Collapse sidebar')}
            title={sidebarCollapsed ? (language === 'zh' ? '展开侧边栏' : 'Expand sidebar') : (language === 'zh' ? '折叠侧边栏' : 'Collapse sidebar')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarCollapsed ? <path d="m9 18 6-6-6-6" /> : <path d="m15 18-6-6 6-6" />}
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  data-testid={navTestId(item.to)}
                  aria-label={item.label}
                  title={item.label}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  {item.icon}
                  <span className="nav-item-label">{item.label}</span>
                  {item.badgeKey ? <span className="nav-badge">{counts[item.badgeKey]}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="footer-row">
            <span className="footer-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
              <span>{copy.darkMode}</span>
            </span>
            <label className="sw">
              <input type="checkbox" checked={theme === 'dark'} onChange={(event) => setTheme(event.target.checked ? 'dark' : 'light')} />
              <div className="sw-track"></div>
              <div className="sw-knob"></div>
            </label>
          </div>

          <div className="footer-row">
            <span className="footer-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
              <span>{copy.language}</span>
            </span>
            <div className="lang-seg">
              <span className={footerLangClass.zh} data-testid="language.zh" onClick={() => setUiLanguage('zh')}>中</span>
              <span className={footerLangClass.en} data-testid="language.en" onClick={() => setUiLanguage('en')}>EN</span>
            </div>
          </div>

          <button className="footer-btn" onClick={() => setPaletteOpen(true)}>
            <span>⌘K</span>
            <span className="footer-btn-text">{language === 'zh' ? '打开命令面板' : 'Open command palette'}</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      {paletteOpen ? (
        <div className="command-palette-overlay" onClick={() => setPaletteOpen(false)}>
          <div className="command-palette" onClick={(event) => event.stopPropagation()}>
            <div className="command-palette-head">
              <input
                autoFocus
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder={language === 'zh' ? '输入页面名称，回车跳转…' : 'Type a page name and press Enter…'}
              />
              <span className="command-palette-hint">⌘K</span>
            </div>
            <div className="command-palette-list">
              {!filteredQuickNavItems.length ? (
                <div className="command-palette-empty">{language === 'zh' ? '没有匹配项' : 'No results'}</div>
              ) : filteredQuickNavItems.map((item, index) => (
                <button
                  key={item.to}
                  className={`command-palette-item ${index === paletteIndex ? 'active' : ''}`}
                  onMouseEnter={() => setPaletteIndex(index)}
                  onClick={() => {
                    navigate(item.to)
                    setPaletteOpen(false)
                  }}
                >
                  <span>{item.label}</span>
                  <span className="command-palette-group">{item.group}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
