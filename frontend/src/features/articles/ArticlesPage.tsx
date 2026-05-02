import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchToolbar } from '@/components/ui/SearchToolbar'
import { Alert, EmptyState } from '@/components/ui/States'
import { useI18n } from '@/i18n/useI18n'
import { consumeWorkbenchTaskDraft } from '@/lib/workbenchDrafts'
import { articlesApi, keywordsApi } from '@/services/api'
import type { ArticleItem, ArticleStatus, KeywordItem } from '@/types'

const emptyForm: { title: string; content: string; status: ArticleStatus; keyword_ids: string[] } = {
  title: '',
  content: '',
  status: 'draft',
  keyword_ids: [],
}

function readApiError(issue: any, fallback: string) {
  return issue?.response?.data?.detail?.message || issue?.userMessage || issue?.message || fallback
}

export function ArticlesPage() {
  const auth = useAuth()
  const { t, language } = useI18n()
  const copy = t.articles
  const common = t.common
  const navigate = useNavigate()
  const [items, setItems] = useState<ArticleItem[]>(auth.bootstrapData?.articles || [])
  const [keywords, setKeywords] = useState<KeywordItem[]>(auth.bootstrapData?.keywords || [])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ArticleStatus | ''>('')
  const [selectedId, setSelectedId] = useState('')
  const [inspector, setInspector] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [keywordInput, setKeywordInput] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    if (auth.bootstrapData) {
      setItems(auth.bootstrapData.articles)
      setKeywords(auth.bootstrapData.keywords)
      setError('')
      return
    }
    try {
      const [articleList, keywordList] = await Promise.all([articlesApi.list(), keywordsApi.list()])
      setItems(articleList)
      setKeywords(keywordList)
      setError('')
    } catch (issue: any) {
      setItems([])
      setKeywords([])
      setError(readApiError(issue, language === 'zh' ? '文章加载失败。' : 'Failed to load articles.'))
    }
  }

  useEffect(() => {
    load()
  }, [auth.bootstrapData])

  useEffect(() => {
    const draft = consumeWorkbenchTaskDraft('articles')
    if (!draft?.prefill) return
    const nextTitle = typeof draft.prefill.title === 'string' ? draft.prefill.title : ''
    const nextSearch = typeof draft.prefill.search === 'string' ? draft.prefill.search : nextTitle
    const nextStatus = typeof draft.prefill.status === 'string' ? draft.prefill.status : ''
    if (nextTitle) setQuickTitle(nextTitle)
    if (nextSearch) setSearch(nextSearch)
    if (nextStatus === 'draft' || nextStatus === 'published') setStatus(nextStatus)
  }, [])

  const keywordMap = useMemo(() => new Map(keywords.map((item) => [item.id, item.keyword])), [keywords])

  const parseKeywordIds = (value: string) => {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((name) => keywords.find((keyword) => keyword.keyword === name)?.id)
      .filter(Boolean) as string[]
  }

  const filtered = useMemo(() => items.filter((item) => {
    if (status && item.status !== status) return false
    if (!search) return true
    const q = search.toLowerCase()
    return item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q)
  }), [items, search, status])

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId('')
      return
    }
    if (!selectedId || !filtered.some((item) => item.id === selectedId)) setSelectedId(filtered[0].id)
  }, [filtered, selectedId])

  const selected = useMemo(() => filtered.find((item) => item.id === selectedId) ?? null, [filtered, selectedId])

  useEffect(() => {
    if (!selected) {
      setInspector(emptyForm)
      setKeywordInput('')
      return
    }
    const next = {
      title: selected.title,
      content: selected.content,
      status: selected.status,
      keyword_ids: selected.keyword_ids,
    }
    setInspector(next)
    setKeywordInput(next.keyword_ids.map((id) => keywordMap.get(id) || '').filter(Boolean).join(', '))
  }, [keywordMap, selected])

  const dirty = useMemo(() => {
    if (!selected) return false
    const keywordsChanged = inspector.keyword_ids.length !== selected.keyword_ids.length
      || inspector.keyword_ids.some((id, index) => id !== selected.keyword_ids[index])
    return inspector.title !== selected.title
      || inspector.content !== selected.content
      || inspector.status !== selected.status
      || keywordsChanged
  }, [inspector, selected])

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return
      if (!filtered.length) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') return
      if (event.key.toLowerCase() === 'j' || event.key === 'ArrowDown') {
        event.preventDefault()
        const index = Math.max(filtered.findIndex((item) => item.id === selectedId), 0)
        setSelectedId(filtered[Math.min(index + 1, filtered.length - 1)].id)
      }
      if (event.key.toLowerCase() === 'k' || event.key === 'ArrowUp') {
        event.preventDefault()
        const index = Math.max(filtered.findIndex((item) => item.id === selectedId), 0)
        setSelectedId(filtered[Math.max(index - 1, 0)].id)
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [filtered, selectedId])

  const patchItem = async (id: string, payload: Partial<ArticleItem>) => {
    try {
      const updated = await articlesApi.update(id, payload)
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)))
      auth.mutateBootstrapData((current) => current ? {
        ...current,
        articles: current.articles.map((item) => (item.id === id ? updated : item)),
        sync_meta: { ...current.sync_meta, synced_at: new Date().toISOString() },
      } : current)
      setError('')
    } catch (issue: any) {
      setError(readApiError(issue, language === 'zh' ? '文章保存失败。' : 'Failed to save article.'))
    }
  }

  const onCreate = async () => {
    const title = quickTitle.trim()
    if (!title || creating) return
    setCreating(true)
    try {
      const item = await articlesApi.create({ ...emptyForm, title })
      setItems((prev) => [item, ...prev])
      auth.mutateBootstrapData((current) => current ? {
        ...current,
        articles: [item, ...current.articles],
        sync_meta: {
          ...current.sync_meta,
          synced_at: new Date().toISOString(),
          counts: { ...current.sync_meta.counts, articles: current.sync_meta.counts.articles + 1 },
        },
      } : current)
      setSelectedId(item.id)
      setQuickTitle('')
      setError('')
    } catch (issue: any) {
      setError(readApiError(issue, language === 'zh' ? '文章创建失败。' : 'Failed to create article.'))
    } finally {
      setCreating(false)
    }
  }

  const saveInspector = async () => {
    if (!selected || !inspector.title.trim() || saving) return
    setSaving(true)
    try {
      await patchItem(selected.id, inspector)
    } finally {
      setSaving(false)
    }
  }

  const removeArticle = async (id: string) => {
    try {
      await articlesApi.remove(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      auth.mutateBootstrapData((current) => current ? {
        ...current,
        articles: current.articles.filter((item) => item.id !== id),
        sync_meta: {
          ...current.sync_meta,
          synced_at: new Date().toISOString(),
          counts: { ...current.sync_meta.counts, articles: Math.max(0, current.sync_meta.counts.articles - 1) },
        },
      } : current)
      setError('')
    } catch (issue: any) {
      setError(readApiError(issue, language === 'zh' ? '文章删除失败。' : 'Failed to delete article.'))
    }
  }

  const metrics = useMemo(() => ({
    total: filtered.length,
    draft: filtered.filter((item) => item.status === 'draft').length,
    published: filtered.filter((item) => item.status === 'published').length,
  }), [filtered])

  return (
    <div id="page-articles" className="page page-active">
      <PageHeader
        title={copy.title}
        description={copy.desc}
        actions={
          <div className="linear-header-meta">
            <span>{language === 'zh' ? '键盘导航' : 'Keyboard navigation'}</span>
            <span>J / K</span>
            <button className="btn btn-xs" onClick={() => navigate('/articles/geo-writer')}>{copy.writer}</button>
            <button className="btn btn-xs" onClick={() => navigate('/articles/image-planner')}>{copy.imagePlanner}</button>
          </div>
        }
      />

      <div className="page-body">
        {error ? <Alert tone="warn">{error}</Alert> : null}
        <div className="linear-workbench">
          <section className="linear-left">
            <Card>
              <div className="linear-panel-title">{language === 'zh' ? '快速创建' : 'Quick Create'}</div>
              <div className="linear-inline-create">
                <input
                  data-testid="articles.quick-input"
                  value={quickTitle}
                  onChange={(event) => setQuickTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onCreate()
                  }}
                  placeholder={copy.articleTitle}
                />
                <button className="btn btn-primary btn-sm" data-testid="articles.create-button" onClick={onCreate} disabled={creating}>
                  {copy.manual}
                </button>
              </div>
            </Card>

            <Card>
              <div className="linear-panel-title">{language === 'zh' ? '筛选' : 'Filters'}</div>
              <SearchToolbar>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={language === 'zh' ? '搜索标题或正文' : 'Search title or content'} />
              </SearchToolbar>
              <div className="linear-filter-stack">
                <select value={status} onChange={(event) => setStatus(event.target.value as ArticleStatus | '')}>
                  <option value="">{language === 'zh' ? '全部状态' : 'All status'}</option>
                  <option value="draft">{common.draft}</option>
                  <option value="published">{common.published}</option>
                </select>
              </div>
            </Card>

            <Card>
              <div className="linear-panel-title">{language === 'zh' ? '概览' : 'Overview'}</div>
              <div className="linear-metric-list">
                <div><span>{language === 'zh' ? '总计' : 'Total'}</span><strong>{metrics.total}</strong></div>
                <div><span>{common.draft}</span><strong>{metrics.draft}</strong></div>
                <div><span>{common.published}</span><strong>{metrics.published}</strong></div>
              </div>
            </Card>
          </section>

          <section className="linear-main">
            <div className="linear-table-wrap">
              <table className="tbl linear-table table-comfort">
                <thead>
                  <tr>
                    <th>{copy.articleTitle}</th>
                    <th className="table-col-select">{copy.status}</th>
                    <th>{copy.related}</th>
                    <th>{language === 'zh' ? '字数' : 'Words'}</th>
                    <th>{language === 'zh' ? '更新时间' : 'Updated'}</th>
                    <th>{language === 'zh' ? '操作' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {!filtered.length ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState title={language === 'zh' ? '还没有文章' : 'No articles yet'} description={copy.empty} />
                      </td>
                    </tr>
                  ) : filtered.map((item) => (
                    <tr
                      key={item.id}
                      data-testid={`articles.row.${item.id}`}
                      className={item.id === selectedId ? 'selected' : ''}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <td><button className="linear-cell-link" onClick={() => setSelectedId(item.id)}>{item.title}</button></td>
                      <td className="table-col-select">
                        <select className="linear-cell-select table-inline-select" value={item.status} onChange={(event) => patchItem(item.id, { status: event.target.value as ArticleStatus })}>
                          <option value="draft">{common.draft}</option>
                          <option value="published">{common.published}</option>
                        </select>
                      </td>
                      <td>{item.keyword_ids.length}</td>
                      <td>{wordCount(item.content)}</td>
                      <td>{new Date(item.updated_at).toLocaleDateString()}</td>
                      <td>
                        <div className="linear-row-actions">
                          <button className="btn btn-xs" onClick={() => setSelectedId(item.id)}>{common.edit}</button>
                          <button className="btn btn-xs btn-danger" onClick={() => removeArticle(item.id)}>{common.remove}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="linear-right">
            {!selected ? (
              <EmptyState
                title={language === 'zh' ? '还没有选中文章' : 'No article selected'}
                description={language === 'zh' ? '选择一篇文章查看详情。' : 'Select an article to inspect details.'}
              />
            ) : (
              <Card className="linear-inspector">
                <div className="linear-panel-title">{language === 'zh' ? '检查器' : 'Inspector'}</div>
                <div className="linear-inspector-grid">
                  <Field label={copy.articleTitle}>
                    <input value={inspector.title} onChange={(event) => setInspector({ ...inspector, title: event.target.value })} />
                  </Field>
                  <Field label={copy.status}>
                    <select value={inspector.status} onChange={(event) => setInspector({ ...inspector, status: event.target.value as ArticleStatus })}>
                      <option value="draft">{common.draft}</option>
                      <option value="published">{common.published}</option>
                    </select>
                  </Field>
                  <Field label={copy.related}>
                    <input
                      value={keywordInput}
                      onChange={(event) => {
                        setKeywordInput(event.target.value)
                        setInspector({ ...inspector, keyword_ids: parseKeywordIds(event.target.value) })
                      }}
                      placeholder={copy.relatedPlaceholder}
                    />
                  </Field>
                  <Field label={copy.content}>
                    <textarea rows={14} value={inspector.content} onChange={(event) => setInspector({ ...inspector, content: event.target.value })} />
                  </Field>
                  {inspector.keyword_ids.length ? (
                    <div className="tag-row">
                      {inspector.keyword_ids.map((id) => <span key={id} className="a-chip">{keywordMap.get(id) || id}</span>)}
                    </div>
                  ) : null}
                </div>
                <div className="linear-inspector-actions">
                  <button className="btn btn-sm" data-testid="articles.remove-button" onClick={() => removeArticle(selected.id)}>{common.remove}</button>
                  <button className="btn btn-primary btn-sm" data-testid="articles.save-button" onClick={saveInspector} disabled={!dirty || saving}>
                    {saving ? common.generating : common.save}
                  </button>
                </div>
              </Card>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function wordCount(content: string) {
  return content.trim() ? content.trim().split(/\s+/).length : 0
}
