import { Link } from 'react-router-dom'
import { readRecentRoutes } from '@/lib/workbenchDrafts'
import { useUiLanguage } from '@/hooks/useUiLanguage'

const ROUTE_LABELS: Record<string, { zh: string; en: string }> = {
  '/dashboard': { zh: '部署进度', en: 'Dashboard' },
  '/keywords': { zh: '关键词库', en: 'Keyword Library' },
  '/articles': { zh: '文章追踪', en: 'Article Tracker' },
  '/articles/geo-writer': { zh: 'GEO Writer', en: 'GEO Writer' },
  '/articles/image-planner': { zh: '配图分析', en: 'Image Planner' },
  '/keywords/recommend': { zh: '关键词推荐', en: 'Keyword Recommendations' },
  '/keywords/analyze': { zh: '关键词分析', en: 'Keyword Analysis' },
  '/import': { zh: '批量导入', en: 'Bulk Import' },
  '/matrix': { zh: '矩阵视图', en: 'Matrix View' },
  '/rank-tracker': { zh: '排名追踪', en: 'Rank Tracker' },
  '/indexing': { zh: 'Google Indexing', en: 'Google Indexing' },
  '/settings': { zh: '设置', en: 'Settings' },
  '/local-data': { zh: '本地数据', en: 'Local Data' },
}

const WORKFLOW_CARDS = {
  zh: [
    {
      title: '先整理关键词库',
      desc: '先把核心词、长尾词和场景词整理清楚，再推进后续写作和验证。',
      href: '/keywords',
      meta: '适合搭基础结构',
    },
    {
      title: '再进入内容生产',
      desc: '从关键词进入文章追踪和 GEO Writer，把草稿、配图和发布状态串起来。',
      href: '/articles/geo-writer',
      meta: '适合直接推进产出',
    },
    {
      title: '最后验证收录与排名',
      desc: '发布后再检查 Indexing、Rank 和本地数据，完成闭环。',
      href: '/indexing',
      meta: '适合上线后的收尾验证',
    },
  ],
  en: [
    {
      title: 'Start with the keyword library',
      desc: 'Organize core, long-tail, and scenario terms before pushing writing and validation forward.',
      href: '/keywords',
      meta: 'Best for building the base',
    },
    {
      title: 'Move into content production',
      desc: 'Carry keyword work into article tracking and GEO Writer so drafts, imagery, and publishing stay connected.',
      href: '/articles/geo-writer',
      meta: 'Best for direct production',
    },
    {
      title: 'Validate indexing and rank',
      desc: 'After publishing, use indexing, rank, and local data to close the loop cleanly.',
      href: '/indexing',
      meta: 'Best for post-launch validation',
    },
  ],
}

const QUICK_LINKS = {
  zh: [
    { label: '部署进度', href: '/dashboard' },
    { label: '关键词推荐', href: '/keywords/recommend' },
    { label: '关键词分析', href: '/keywords/analyze' },
    { label: '本地数据', href: '/local-data' },
  ],
  en: [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Keyword Recommendations', href: '/keywords/recommend' },
    { label: 'Keyword Analysis', href: '/keywords/analyze' },
    { label: 'Local Data', href: '/local-data' },
  ],
}

export function AIHomePage() {
  const language = useUiLanguage()
  const recentRoutes = readRecentRoutes()
  const cards = language === 'zh' ? WORKFLOW_CARDS.zh : WORKFLOW_CARDS.en
  const quickLinks = language === 'zh' ? QUICK_LINKS.zh : QUICK_LINKS.en

  return (
    <div id="page-ai-home" className="page page-active ai-home-page">
      <div className="ai-home-shell">
        <section className="ai-home-hero">
          <div className="ai-home-kicker">{language === 'zh' ? 'SmartKey 工作台首页' : 'SmartKey Workbench Home'}</div>
          <h1 className="page-title">
            {language === 'zh' ? '从一条清晰的工作流开始' : 'Start from a clear workflow'}
          </h1>
          <p className="page-desc">
            {language === 'zh'
              ? '这里不再堆叠额外工具，而是把建库、写作、验证三条主链路拆清楚，让每次进入都有明确起点。'
              : 'This home page now favors clear workflows over extra tooling, so every session begins from an explicit path.'}
          </p>
          <div className="ai-home-hero-actions">
            <Link to="/keywords" className="ai-home-primary-link">
              {language === 'zh' ? '进入关键词库' : 'Open Keyword Library'}
            </Link>
            <Link to="/articles/geo-writer" className="ai-home-secondary-link">
              {language === 'zh' ? '直接开始写文章' : 'Start Writing'}
            </Link>
          </div>
        </section>

        <section className="ai-home-band">
          <div className="ai-home-band-copy">
            <strong>{language === 'zh' ? '今天先推进哪一段？' : 'What should move first today?'}</strong>
            <span>
              {language === 'zh'
                ? '建议先把“建库 -> 写作 -> 验证”跑通，再补可选模块。'
                : 'Move through library -> writing -> validation first, then add optional modules as needed.'}
            </span>
          </div>
          <div className="ai-home-band-links">
            {quickLinks.map((item) => (
              <Link key={item.href} to={item.href} className="ai-home-band-chip">
                {item.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="ai-home-workflows">
          {cards.map((item) => (
            <Link key={item.href} to={item.href} className="ai-home-workflow-card">
              <span className="ai-home-workflow-meta">{item.meta}</span>
              <strong>{item.title}</strong>
              <p>{item.desc}</p>
              <span className="ai-home-workflow-link">
                {language === 'zh' ? '进入模块' : 'Open module'}
              </span>
            </Link>
          ))}
        </section>

        <section className="ai-home-lower">
          <div className="ai-home-panel">
            <div className="ai-home-panel-head">
              <div>
                <div className="ai-home-section-title">{language === 'zh' ? '最近页面' : 'Recent Pages'}</div>
                <div className="ai-home-section-subtitle">
                  {language === 'zh' ? '继续上次中断的工作流。' : 'Resume the last interrupted workflow.'}
                </div>
              </div>
            </div>
            {!recentRoutes.length ? (
              <div className="ai-home-empty">
                {language === 'zh'
                  ? '还没有跨页记录，先从上面的三条主链路开始。'
                  : 'No cross-page history yet. Start from one of the three primary workflows above.'}
              </div>
            ) : (
              <div className="ai-home-route-list">
                {recentRoutes.map((route) => (
                  <Link key={route} to={route} className="ai-home-route-link">
                    <span>{ROUTE_LABELS[route]?.[language] || route}</span>
                    <small>{route}</small>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="ai-home-panel">
            <div className="ai-home-panel-head">
              <div>
                <div className="ai-home-section-title">{language === 'zh' ? '工作原则' : 'Working Principles'}</div>
                <div className="ai-home-section-subtitle">
                  {language === 'zh'
                    ? '把首页做成方向盘，而不是第二个工具堆。'
                    : 'Make the home page a steering wheel, not another tool stack.'}
                </div>
              </div>
            </div>
            <div className="ai-home-principles">
              <div className="ai-home-principle">
                <strong>{language === 'zh' ? '先建库' : 'Library first'}</strong>
                <span>{language === 'zh' ? '关键词结构清楚，后面的写作和验证才会稳定。' : 'Clear keyword structure keeps writing and validation stable.'}</span>
              </div>
              <div className="ai-home-principle">
                <strong>{language === 'zh' ? '再产出' : 'Then produce'}</strong>
                <span>{language === 'zh' ? '内容生产集中在文章追踪和 GEO Writer，不在首页分散操作。' : 'Content production stays centered in article tracking and GEO Writer, not scattered across the home page.'}</span>
              </div>
              <div className="ai-home-principle">
                <strong>{language === 'zh' ? '最后验证' : 'Finally validate'}</strong>
                <span>{language === 'zh' ? 'Indexing、Rank 和本地数据放在后链路，帮助你把收尾做完整。' : 'Indexing, rank, and local data live later in the chain to help you finish the loop cleanly.'}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
