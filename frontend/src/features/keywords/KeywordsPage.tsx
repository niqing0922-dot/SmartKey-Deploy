import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchToolbar } from '@/components/ui/SearchToolbar'
import { EmptyState } from '@/components/ui/States'
import { useI18n } from '@/i18n/useI18n'
import { consumeWorkbenchTaskDraft } from '@/lib/workbenchDrafts'
import { keywordsApi } from '@/services/api'
import type { KeywordItem, KeywordPriority, KeywordStatus, KeywordType } from '@/types'

const emptyForm = {
  keyword: '',
  type: 'core' as KeywordType,
  priority: 'medium' as KeywordPriority,
  status: 'pending' as KeywordStatus,
  notes: '',
  position: '',
  related_article: '',
}

export function KeywordsPage() {
  const { t, language } = useI18n()
  const copy = t.keywords
  const common = t.common

  const [items, setItems] = useState<KeywordItem[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [sort, setSort] = useState('default')
  const [selectedId, setSelectedId] = useState('')
  const [inspector, setInspector] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [quickKeyword, setQuickKeyword] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingKeyword, setEditingKeyword] = useState('')

  const load = async () => {
    const list = await keywordsApi.list()
    setItems(list)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const draft = consumeWorkbenchTaskDraft('keywords')
    if (draft?.prefill) {
      const keyword = typeof draft.prefill.keyword === 'string' ? draft.prefill.keyword : ''
      const quick = typeof draft.prefill.quickKeyword === 'string' ? draft.prefill.quickKeyword : keyword
      const nextSearch = typeof draft.prefill.search === 'string' ? draft.prefill.search : keyword
      const nextType = typeof draft.prefill.type === 'string' ? draft.prefill.type : ''
      const nextStatus = typeof draft.prefill.status === 'string' ? draft.prefill.status : ''
      if (keyword || quick || nextSearch) {
        setSearch(nextSearch)
        setQuickKeyword(quick || keyword)
      }
      if (nextType) setType(nextType)
      if (nextStatus) setStatus(nextStatus)
      return
    }

    const raw = window.localStorage.getItem('smartkey.global.keywords')
    if (!raw) return
    try {
      const legacy = JSON.parse(raw)
      if (typeof legacy.keyword === 'string') {
        setSearch(legacy.keyword)
        setQuickKeyword(legacy.keyword)
      }
    } finally {
      window.localStorage.removeItem('smartkey.global.keywords')
    }
  }, [])

  const filtered = useMemo(() => {
    const next = items.filter((item) => {
      if (search && !item.keyword.toLowerCase().includes(search.toLowerCase())) return false
      if (status && item.status !== status) return false
      if (type && item.type !== type) return false
      return true
    })
    if (sort === 'alpha') next.sort((a, b) => a.keyword.localeCompare(b.keyword))
    if (sort === 'type') next.sort((a, b) => a.type.localeCompare(b.type))
    if (sort === 'updated') next.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    return next
  }, [items, search, sort, status, type])

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
      return
    }
    setInspector({
      keyword: selected.keyword,
      type: selected.type,
      priority: selected.priority,
      status: selected.status,
      notes: selected.notes,
      position: selected.position,
      related_article: selected.related_article,
    })
  }, [selected])

  const dirty = useMemo(() => {
    if (!selected) return false
    return (
      inspector.keyword !== selected.keyword
      || inspector.type !== selected.type
      || inspector.priority !== selected.priority
      || inspector.status !== selected.status
      || inspector.notes !== selected.notes
      || inspector.position !== selected.position
      || inspector.related_article !== selected.related_article
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

  const patchItem = async (id: string, payload: Partial<KeywordItem>) => {
    await keywordsApi.update(id, payload)
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...payload } : item)))
  }

  const onCreate = async () => {
    const keyword = quickKeyword.trim()
    if (!keyword || creating) return
    setCreating(true)
    try {
      const item = await keywordsApi.create({ ...emptyForm, keyword })
      setItems((prev) => [item, ...prev])
      setSelectedId(item.id)
      setQuickKeyword('')
    } finally {
      setCreating(false)
    }
  }

  const saveInspector = async () => {
    if (!selected || !inspector.keyword.trim() || saving) return
    setSaving(true)
    try {
      await patchItem(selected.id, inspector)
    } finally {
      setSaving(false)
    }
  }

  const removeSelected = async () => {
    if (!selected) return
    await keywordsApi.remove(selected.id)
    setItems((prev) => prev.filter((item) => item.id !== selected.id))
  }

  const startInlineKeyword = (item: KeywordItem) => {
    setEditingId(item.id)
    setEditingKeyword(item.keyword)
  }

  const saveInlineKeyword = async (item: KeywordItem) => {
    const keyword = editingKeyword.trim()
    setEditingId('')
    if (!keyword || keyword === item.keyword) return
    await patchItem(item.id, { keyword })
  }

  const metrics = useMemo(() => ({
    all: filtered.length,
    pending: filtered.filter((item) => item.status === 'pending').length,
    planned: filtered.filter((item) => item.status === 'planned').length,
    done: filtered.filter((item) => item.status === 'done').length,
  }), [filtered])

  return (
    <div id="page-library" className="page page-active">
      <PageHeader
        title={copy.title}
        description={copy.desc}
        actions={
          <div className="linear-header-meta">
            <span>{language === 'zh' ? '键盘导航' : 'Keyboard navigation'}</span>
            <span>J / K</span>
            <span>{copy.currentResults.replace('{count}', String(filtered.length))}</span>
          </div>
        }
      />

      <div className="page-body linear-workbench">
        <section className="linear-left">
          <Card>
            <div className="linear-panel-title">{language === 'zh' ? '快速新增' : 'Quick Add'}</div>
            <div className="linear-inline-create">
              <input
                data-testid="keywords.quick-input"
                value={quickKeyword}
                onChange={(event) => setQuickKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onCreate()
                }}
                placeholder={copy.keywordPlaceholder}
              />
              <button className="btn btn-primary btn-sm" data-testid="keywords.create-button" onClick={onCreate} disabled={creating}>
                {common.add}
              </button>
            </div>
          </Card>

          <Card>
            <div className="linear-panel-title">{language === 'zh' ? '筛选' : 'Filters'}</div>
            <SearchToolbar>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} />
            </SearchToolbar>
            <div className="linear-filter-stack">
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">{copy.allStatus}</option>
                <option value="pending">{common.pending}</option>
                <option value="planned">{common.planned}</option>
                <option value="done">{common.published}</option>
              </select>
              <select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="">{copy.allTypes}</option>
                {Object.entries(copy.typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="default">{copy.defaultSort}</option>
                <option value="alpha">{copy.alpha}</option>
                <option value="type">{copy.typeSort}</option>
                <option value="updated">{language === 'zh' ? '最近更新' : 'Recently updated'}</option>
              </select>
            </div>
          </Card>

          <Card>
            <div className="linear-panel-title">{language === 'zh' ? '概览' : 'Overview'}</div>
            <div className="linear-metric-list">
              <div><span>{language === 'zh' ? '总计' : 'Total'}</span><strong>{metrics.all}</strong></div>
              <div><span>{common.pending}</span><strong>{metrics.pending}</strong></div>
              <div><span>{common.planned}</span><strong>{metrics.planned}</strong></div>
              <div><span>{common.published}</span><strong>{metrics.done}</strong></div>
            </div>
          </Card>
        </section>

        <section className="linear-main">
          <div className="linear-table-wrap">
            <table className="tbl linear-table table-comfort">
              <thead>
                <tr>
                  <th>{copy.table[0]}</th>
                  <th>{copy.table[1]}</th>
                  <th className="table-col-select">{copy.table[2]}</th>
                  <th className="table-col-compact">{copy.table[3]}</th>
                  <th>{copy.table[5]}</th>
                  <th>{copy.table[4]}</th>
                  <th>{language === 'zh' ? '更新时间' : 'Updated'}</th>
                  <th>{copy.table[7]}</th>
                </tr>
              </thead>
              <tbody>
                {!filtered.length ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        title={language === 'zh' ? '还没有关键词' : 'No keywords yet'}
                        description={copy.empty}
                      />
                    </td>
                  </tr>
                ) : filtered.map((item) => (
                  <tr
                    key={item.id}
                    data-testid={`keywords.row.${item.id}`}
                    className={item.id === selectedId ? 'selected' : ''}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <td>
                      {editingId === item.id ? (
                        <input
                          autoFocus
                          value={editingKeyword}
                          onChange={(event) => setEditingKeyword(event.target.value)}
                          onBlur={() => saveInlineKeyword(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') saveInlineKeyword(item)
                            if (event.key === 'Escape') setEditingId('')
                          }}
                        />
                      ) : (
                        <button className="linear-cell-link" onClick={() => startInlineKeyword(item)}>{item.keyword}</button>
                      )}
                    </td>
                    <td><span className={`badge ${badgeClassForType(item.type)}`}>{copy.typeLabels[item.type]}</span></td>
                    <td className="table-col-select">
                      <select
                        className="linear-cell-select table-inline-select"
                        value={item.status}
                        onChange={(event) => patchItem(item.id, { status: event.target.value as KeywordStatus })}
                      >
                        <option value="pending">{common.pending}</option>
                        <option value="planned">{common.planned}</option>
                        <option value="done">{common.published}</option>
                      </select>
                    </td>
                    <td className="table-col-compact">
                      <select
                        className="linear-cell-select table-inline-select"
                        value={item.priority}
                        onChange={(event) => patchItem(item.id, { priority: event.target.value as KeywordPriority })}
                      >
                        {Object.entries(copy.priorityLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td>{item.position || '-'}</td>
                    <td>{item.related_article || '-'}</td>
                    <td>{new Date(item.updated_at).toLocaleDateString()}</td>
                    <td>
                      <div className="linear-row-actions">
                        <button className="btn btn-xs" onClick={() => setSelectedId(item.id)}>{common.edit}</button>
                        <button className="btn btn-xs btn-danger" onClick={async () => {
                          await keywordsApi.remove(item.id)
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
            <EmptyState
              title={language === 'zh' ? '还没有选中关键词' : 'No keyword selected'}
              description={language === 'zh' ? '选择一条关键词查看详情。' : 'Select a keyword to inspect details.'}
            />
          ) : (
            <Card className="linear-inspector">
              <div className="linear-panel-title">{language === 'zh' ? '检查器' : 'Inspector'}</div>
              <div className="linear-inspector-grid">
                <Field label={copy.keyword}>
                  <input value={inspector.keyword} onChange={(event) => setInspector({ ...inspector, keyword: event.target.value })} />
                </Field>
                <Field label={copy.type}>
                  <select value={inspector.type} onChange={(event) => setInspector({ ...inspector, type: event.target.value as KeywordType })}>
                    {Object.entries(copy.typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
                <Field label={copy.priority}>
                  <select value={inspector.priority} onChange={(event) => setInspector({ ...inspector, priority: event.target.value as KeywordPriority })}>
                    {Object.entries(copy.priorityLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
                <Field label={copy.table[2]}>
                  <select value={inspector.status} onChange={(event) => setInspector({ ...inspector, status: event.target.value as KeywordStatus })}>
                    <option value="pending">{common.pending}</option>
                    <option value="planned">{common.planned}</option>
                    <option value="done">{common.published}</option>
                  </select>
                </Field>
                <Field label={copy.table[4]}>
                  <input value={inspector.related_article} onChange={(event) => setInspector({ ...inspector, related_article: event.target.value })} />
                </Field>
                <Field label={copy.table[5]}>
                  <input value={inspector.position} onChange={(event) => setInspector({ ...inspector, position: event.target.value })} />
                </Field>
                <Field label={copy.notes}>
                  <textarea rows={8} value={inspector.notes} onChange={(event) => setInspector({ ...inspector, notes: event.target.value })} />
                </Field>
              </div>
              <div className="linear-inspector-actions">
                <button className="btn btn-sm" data-testid="keywords.remove-button" onClick={removeSelected}>{common.remove}</button>
                <button className="btn btn-primary btn-sm" data-testid="keywords.save-button" onClick={saveInspector} disabled={!dirty || saving}>
                  {saving ? common.generating : common.save}
                </button>
              </div>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}

function badgeClassForType(type: KeywordType) {
  switch (type) {
    case 'core': return 'b-core'
    case 'longtail': return 'b-long'
    case 'scenario': return 'b-scene'
    case 'persona': return 'b-customer'
    case 'qa': return 'b-question'
    case 'competitor': return 'b-compete'
    case 'brand': return 'b-brand'
    default: return ''
  }
}
