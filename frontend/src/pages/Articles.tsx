import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { articlesApi, keywordsApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'
import type { ArticleItem, ArticleStatus, KeywordItem } from '@/types'

const emptyForm: { title: string; content: string; status: ArticleStatus; keyword_ids: string[] } = {
  title: '',
  content: '',
  status: 'draft',
  keyword_ids: [],
}

export function ArticlesPage() {
  const { t, language } = useI18n()
  const copy = t.articles
  const common = t.common
  const navigate = useNavigate()

  const [items, setItems] = useState<ArticleItem[]>([])
  const [keywords, setKeywords] = useState<KeywordItem[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ArticleStatus | ''>('')
  const [selectedId, setSelectedId] = useState('')
  const [inspector, setInspector] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [keywordInput, setKeywordInput] = useState('')

  const load = async () => {
    const [articleList, keywordList] = await Promise.all([articlesApi.list(), keywordsApi.list()])
    setItems(articleList)
    setKeywords(keywordList)
  }

  useEffect(() => { load() }, [])

  const keywordMap = useMemo(() => new Map(keywords.map((item) => [item.id, item.keyword])), [keywords])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (status && item.status !== status) return false
      if (!search) return true
      const q = search.toLowerCase()
      return item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q)
    })
  }, [items, search, status])

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId('')
      return
    }
    if (!selectedId || !filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0].id)
    }
  }, [filtered, selectedId])

  const selected = useMemo(
    () => filtered.find((item) => item.id === selectedId) ?? null,
    [filtered, selectedId],
  )

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
    return (
      inspector.title !== selected.title
      || inspector.content !== selected.content
      || inspector.status !== selected.status
      || keywordsChanged
    )
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
    await articlesApi.update(id, payload)
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...payload } : item)))
  }

  const onCreate = async () => {
    const title = quickTitle.trim()
    if (!title || creating) return
    setCreating(true)
    try {
      const item = await articlesApi.create({ ...emptyForm, title })
      setItems((prev) => [item, ...prev])
      setSelectedId(item.id)
      setQuickTitle('')
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

  const removeSelected = async () => {
    if (!selected) return
    await articlesApi.remove(selected.id)
    setItems((prev) => prev.filter((item) => item.id !== selected.id))
  }

  const parseKeywordIds = (value: string) => {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((name) => keywords.find((keyword) => keyword.keyword === name)?.id)
      .filter(Boolean) as string[]
  }

  const metrics = useMemo(() => ({
    total: filtered.length,
    draft: filtered.filter((item) => item.status === 'draft').length,
    published: filtered.filter((item) => item.status === 'published').length,
  }), [filtered])

  return (
    <div id="page-articles" className="page page-active">
      <div className="page-header linear-page-header">
        <div>
          <div className="page-title">{copy.title}</div>
          <div className="page-desc">{copy.desc}</div>
        </div>
        <div className="linear-header-meta">
          <span>⌘K</span>
          <span>J / K</span>
          <button className="btn btn-xs" onClick={() => navigate('/articles/geo-writer')}>{copy.writer}</button>
          <button className="btn btn-xs" onClick={() => navigate('/articles/image-planner')}>{copy.imagePlanner}</button>
        </div>
      </div>

      <div className="page-body linear-workbench">
        <section className="linear-left">
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
            <button className="btn btn-primary btn-sm" data-testid="articles.create-button" onClick={onCreate} disabled={creating}>{copy.manual}</button>
          </div>

          <div className="linear-panel-title">{language === 'zh' ? '筛选' : 'Filters'}</div>
          <div className="linear-filter-stack">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={language === 'zh' ? '搜索标题或正文' : 'Search title or content'} />
            <select value={status} onChange={(event) => setStatus(event.target.value as ArticleStatus | '')}>
              <option value="">{language === 'zh' ? '全部状态' : 'All status'}</option>
              <option value="draft">{common.draft}</option>
              <option value="published">{common.published}</option>
            </select>
          </div>

          <div className="linear-panel-title">{language === 'zh' ? '状态概览' : 'Overview'}</div>
          <div className="linear-metric-list">
            <div><span>{language === 'zh' ? '总计' : 'Total'}</span><strong>{metrics.total}</strong></div>
            <div><span>{common.draft}</span><strong>{metrics.draft}</strong></div>
            <div><span>{common.published}</span><strong>{metrics.published}</strong></div>
          </div>
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
                  <tr><td colSpan={6}><div className="empty">{copy.empty}</div></td></tr>
                ) : filtered.map((item) => (
                  <tr
                    key={item.id}
                    data-testid={`articles.row.${item.id}`}
                    className={item.id === selectedId ? 'selected' : ''}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <td>
                      <button className="linear-cell-link" onClick={() => setSelectedId(item.id)}>
                        {item.title}
                      </button>
                    </td>
                    <td className="table-col-select">
                      <select
                        className="linear-cell-select table-inline-select"
                        value={item.status}
                        onChange={(event) => patchItem(item.id, { status: event.target.value as ArticleStatus })}
                      >
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
                        <button className="btn btn-xs btn-danger" onClick={async () => {
                          await articlesApi.remove(item.id)
                          setItems((prev) => prev.filter((entry) => entry.id !== item.id))
                        }}>{common.remove}</button>
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
            <div className="empty-state">{language === 'zh' ? '选择一篇文章查看详情' : 'Select an article to inspect details'}</div>
          ) : (
            <div className="linear-inspector">
              <div className="linear-panel-title">{language === 'zh' ? '检查器' : 'Inspector'}</div>
              <div className="linear-inspector-grid">
                <div className="field-block">
                  <label>{copy.articleTitle}</label>
                  <input value={inspector.title} onChange={(event) => setInspector({ ...inspector, title: event.target.value })} />
                </div>
                <div className="field-block">
                  <label>{copy.status}</label>
                  <select value={inspector.status} onChange={(event) => setInspector({ ...inspector, status: event.target.value as ArticleStatus })}>
                    <option value="draft">{common.draft}</option>
                    <option value="published">{common.published}</option>
                  </select>
                </div>
                <div className="field-block">
                  <label>{copy.related}</label>
                  <input
                    value={keywordInput}
                    onChange={(event) => {
                      setKeywordInput(event.target.value)
                      setInspector({ ...inspector, keyword_ids: parseKeywordIds(event.target.value) })
                    }}
                    placeholder={copy.relatedPlaceholder}
                  />
                </div>
                <div className="field-block">
                  <label>{copy.content}</label>
                  <textarea rows={14} value={inspector.content} onChange={(event) => setInspector({ ...inspector, content: event.target.value })}></textarea>
                </div>
                {inspector.keyword_ids.length ? (
                  <div className="tag-row">
                    {inspector.keyword_ids.map((id) => <span key={id} className="a-chip">{keywordMap.get(id) || id}</span>)}
                  </div>
                ) : null}
              </div>
              <div className="linear-inspector-actions">
                <button className="btn btn-sm" data-testid="articles.remove-button" onClick={removeSelected}>{common.remove}</button>
                <button className="btn btn-primary btn-sm" data-testid="articles.save-button" onClick={saveInspector} disabled={!dirty || saving}>{saving ? common.generating : common.save}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function wordCount(content: string) {
  return content.trim() ? content.trim().split(/\s+/).length : 0
}
