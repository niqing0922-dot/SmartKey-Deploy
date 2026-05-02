import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { articlesApi, keywordsApi } from '@/services/api'
import { setUiLanguage, useUiLanguage } from '@/hooks/useUiLanguage'
import { messages } from '@/i18n/messages'
import { recordRecentRoute } from '@/lib/workbenchDrafts'
import { SmartKeyLogo } from '@/components/brand/SmartKeyLogo'

type NavBadgeKey = 'keywords' | 'articles' | 'rank'
type NavItem = { to: string; label: string; icon: ReactNode; badgeKey?: NavBadgeKey }
type NavGroup = { label: string; items: NavItem[] }

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

function SparkIcon() {
  return <Icon><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /></Icon>
}

function GridIcon() {
  return <Icon><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></Icon>
}

function LibraryIcon() {
  return <Icon><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></Icon>
}

function ArticlesIcon() {
  return <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h8" /></Icon>
}

function WriterIcon() {
  return <Icon><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></Icon>
}

function MatrixIcon() {
  return <Icon><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></Icon>
}

function RecommendIcon() {
  return <Icon><path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6z" /></Icon>
}

function AnalyzeIcon() {
  return <Icon><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></Icon>
}

function ImageIcon() {
  return <Icon><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m21 15-5-5L5 21" /></Icon>
}

function ImportIcon() {
  return <Icon><path d="M12 12v9" /><path d="m16 16-4-4-4 4" /><path d="M20 18a5 5 0 0 0-2-9h-1A8 8 0 1 0 3 16" /></Icon>
}

function RankIcon() {
  return <Icon><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Icon>
}

function IndexingIcon() {
  return <Icon><circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" /><path d="M8 11h6M11 8v6" /></Icon>
}

function DatabaseIcon() {
  return <Icon><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></Icon>
}

function SettingsIcon() {
  return <Icon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.07.06a2 2 0 0 1-2.84 2.84l-.06-.07a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1.03 1.55V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1.02-1.55 1.7 1.7 0 0 0-1.82.33l-.06.07a2 2 0 1 1-2.84-2.84l.07-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.64 8.5a1.7 1.7 0 0 0-.33-1.82l-.07-.06a2 2 0 1 1 2.84-2.84l.06.07a1.7 1.7 0 0 0 1.82.33 1.7 1.7 0 0 0 1.02-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.82-.33l.06-.07a2 2 0 1 1 2.84 2.84l-.07.06a1.7 1.7 0 0 0-.33 1.82 1.7 1.7 0 0 0 1.55 1.02H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03z" /></Icon>
}

function navTestId(path: string) {
  const key = path === '/' ? 'ai-home' : path.replace(/^\//, '').replace(/[\/]+/g, '.')
  return `nav.${key}`
}

export function AppShell() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const language = useUiLanguage()
  const copy = messages[language].shell
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const legacyDefaultDark = window.localStorage.getItem('smartkey.theme.defaultDark.v1') === '1'
    if (legacyDefaultDark && window.localStorage.getItem('smartkey.theme.lightDefault.v1') !== '1') {
      window.localStorage.setItem('smartkey.theme.lightDefault.v1', '1')
      window.localStorage.setItem('smartkey.theme', 'light')
      return 'light'
    }
    return window.localStorage.getItem('smartkey.theme') === 'dark' ? 'dark' : 'light'
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [counts, setCounts] = useState({ keywords: 0, articles: 0, rank: 0 })
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [paletteIndex, setPaletteIndex] = useState(0)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('smartkey.theme', theme)
  }, [theme])

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem('smartkey.sidebar.collapsed') === '1')
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
  ], [copy.nav, language])

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

  const footerLangClass = {
    zh: language === 'zh' ? 'lang-opt active' : 'lang-opt',
    en: language === 'en' ? 'lang-opt active' : 'lang-opt',
  }

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar" id="sidebar" data-testid="shell.sidebar">
        <div className="sidebar-logo">
          {!sidebarCollapsed ? <SmartKeyLogo className="sidebar-logo-icon" compact /> : null}
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
          <div className="cloud-workspace-chip">
            <strong>{auth.workspace?.name || (language === 'zh' ? '本地工作区' : 'Local Workspace')}</strong>
            <span>{auth.user?.email || (language === 'zh' ? '无需登录即可使用' : 'No sign-in required')}</span>
          </div>
          {auth.session ? (
            <button className="footer-btn" onClick={() => auth.signOut()}>
              <span>↪</span>
              <span className="footer-btn-text">{language === 'zh' ? '退出登录' : 'Sign out'}</span>
            </button>
          ) : null}
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
                placeholder={language === 'zh' ? '输入页面名称，回车跳转...' : 'Type a page name and press Enter...'}
              />
              <span className="command-palette-hint">⌘K</span>
            </div>
            <div className="command-palette-list">
              {!filteredQuickNavItems.length ? (
                <div className="command-palette-empty">{language === 'zh' ? '没有匹配页面' : 'No results'}</div>
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
