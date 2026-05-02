import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card, StatCard } from '@/components/ui/Card'
import { Alert, EmptyState } from '@/components/ui/States'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/auth/AuthProvider'
import { dashboardApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'
import type { DashboardStats, KeywordPriority, KeywordType } from '@/types'
import { formatDate } from '@/lib/format'

export function DashboardPage() {
  const auth = useAuth()
  const { t, language } = useI18n()
  const copy = t.dashboard
  const common = t.common
  const [stats, setStats] = useState<DashboardStats | null>(auth.bootstrapData?.dashboard_stats || null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (auth.bootstrapData?.dashboard_stats) {
      setStats(auth.bootstrapData.dashboard_stats)
      setError('')
      return
    }
    dashboardApi.getStats()
      .then((nextStats) => {
        setStats(nextStats)
        setError('')
      })
      .catch((issue: any) => setError(issue?.response?.data?.detail?.message || issue?.message || (language === 'zh' ? '部署进度加载失败。' : 'Failed to load dashboard.')))
  }, [auth.bootstrapData, language])

  const typeProgress = useMemo(() => {
    const items = stats?.pending_keywords ?? []
    const counts = new Map<KeywordType, number>()
    items.forEach((item) => counts.set(item.type, (counts.get(item.type) ?? 0) + 1))
    return Object.entries(copy.typeLabels).map(([key, label]) => ({
      key,
      label,
      count: counts.get(key as KeywordType) ?? 0,
      width: items.length ? Math.max(8, Math.round(((counts.get(key as KeywordType) ?? 0) / items.length) * 100)) : 0,
    }))
  }, [stats, copy.typeLabels])

  const priorityProgress = useMemo(() => {
    const items = stats?.pending_keywords ?? []
    const counts = new Map<KeywordPriority, number>()
    items.forEach((item) => counts.set(item.priority, (counts.get(item.priority) ?? 0) + 1))
    return Object.entries(copy.priorityLabels).map(([key, label]) => ({
      key,
      label,
      count: counts.get(key as KeywordPriority) ?? 0,
      width: items.length ? Math.max(8, Math.round(((counts.get(key as KeywordPriority) ?? 0) / items.length) * 100)) : 0,
    }))
  }, [stats, copy.priorityLabels])

  return (
    <div id="page-dashboard" className="page page-active">
      <PageHeader
        title={copy.title}
        description={copy.desc}
        actions={
          <div className="linear-header-meta">
            <span>{language === 'zh' ? '工作台总览' : 'Workbench Overview'}</span>
            <span>{copy.updatedAt} {stats ? formatDate(new Date().toISOString()) : '--'}</span>
          </div>
        }
      />

      <div className="page-body">
        {error ? <Alert tone="warn">{error}</Alert> : null}
        <div className="linear-workbench dashboard-linear-workbench">
          <section className="linear-left dashboard-left-stack">
            <StatCard label={copy.total} value={stats?.keywords.total ?? 0} hint={copy.totalSub} />
            <StatCard label={copy.pending} value={stats?.keywords.pending ?? 0} hint={copy.pendingSub} />
            <StatCard label={copy.planned} value={stats?.keywords.planned ?? 0} hint={copy.plannedSub} />
            <StatCard label={copy.done} value={stats?.keywords.done ?? 0} hint={copy.doneSub} />
            <StatCard label={copy.coverage} value={`${stats?.keywords.coverage ?? 0}%`} hint={copy.coverageSub} />

            <Card>
              <div className="linear-panel-title">{language === 'zh' ? '模块状态' : 'Module Status'}</div>
              <div className="linear-metric-list">
                <div><span>AI</span><strong>{stats?.modules.ai ? 'ON' : 'OFF'}</strong></div>
                <div><span>Rank</span><strong>{stats?.modules.rank ? 'ON' : 'OFF'}</strong></div>
                <div><span>Indexing</span><strong>{stats?.modules.indexing ? 'ON' : 'OFF'}</strong></div>
              </div>
            </Card>
          </section>

          <section className="linear-main dashboard-main-stack">
            <Card className="linear-table-wrap">
              <div className="linear-panel-title">{copy.recent}</div>
              <table className="tbl linear-table">
                <thead>
                  <tr>
                    <th>{language === 'zh' ? '最近文章' : 'Recent Articles'}</th>
                    <th>{language === 'zh' ? '状态' : 'Status'}</th>
                    <th>{language === 'zh' ? '更新时间' : 'Updated'}</th>
                  </tr>
                </thead>
                <tbody>
                  {!stats?.recent_articles.length ? (
                    <tr>
                      <td colSpan={3}>
                        <EmptyState title={language === 'zh' ? '还没有文章记录' : 'No articles yet'} description={copy.emptyArticles} />
                      </td>
                    </tr>
                  ) : stats.recent_articles.map((article) => (
                    <tr key={article.id}>
                      <td>{article.title}</td>
                      <td>
                        <Badge tone={article.status === 'published' ? 'success' : 'planned'}>
                          {article.status === 'published' ? common.published : common.draft}
                        </Badge>
                      </td>
                      <td>{formatDate(article.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card className="linear-table-wrap">
              <div className="linear-panel-title">{copy.topPending}</div>
              <table className="tbl linear-table">
                <thead>
                  <tr>
                    <th>{language === 'zh' ? '待分配关键词' : 'Pending Keywords'}</th>
                    <th>{language === 'zh' ? '类型' : 'Type'}</th>
                    <th>{language === 'zh' ? '优先级' : 'Priority'}</th>
                    <th>{language === 'zh' ? '备注' : 'Notes'}</th>
                  </tr>
                </thead>
                <tbody>
                  {!stats?.pending_keywords.length ? (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState title={language === 'zh' ? '当前没有待分配关键词' : 'No pending keywords'} description={copy.emptyPending} />
                      </td>
                    </tr>
                  ) : stats.pending_keywords.slice(0, 20).map((keyword) => (
                    <tr key={keyword.id}>
                      <td>{keyword.keyword}</td>
                      <td>{copy.typeLabels[keyword.type]}</td>
                      <td>{copy.priorityLabels[keyword.priority]}</td>
                      <td>{keyword.notes || copy.noNotes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          <section className="linear-right">
            <Card>
              <div className="linear-panel-title">{copy.typeProgress}</div>
              <div className="progress-panel">
                {typeProgress.map((item) => (
                  <div key={item.key} className="progress-row">
                    <div className="progress-row-head"><span>{item.label}</span><strong>{item.count}</strong></div>
                    <div className="prog-bar"><div className="prog-fill" style={{ width: `${item.width}%` }}></div></div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="linear-panel-title">{copy.priorityProgress}</div>
              <div className="progress-panel">
                {priorityProgress.map((item) => (
                  <div key={item.key} className="progress-row">
                    <div className="progress-row-head"><span>{item.label}</span><strong>{item.count}</strong></div>
                    <div className="prog-bar"><div className="prog-fill prog-fill-accent" style={{ width: `${item.width}%` }}></div></div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </div>
      </div>
    </div>
  )
}
