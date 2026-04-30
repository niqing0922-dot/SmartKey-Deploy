import { useEffect, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/States'
import { keywordsApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'
import { consumeWorkbenchTaskDraft } from '@/lib/workbenchDrafts'
import type { KeywordItem, KeywordStatus, KeywordType } from '@/types'

const cols: Array<{ key: KeywordStatus; labelKey: 'pending' | 'planned' | 'done'; color: string }> = [
  { key: 'pending', labelKey: 'pending', color: 'var(--text-3)' },
  { key: 'planned', labelKey: 'planned', color: 'var(--blue-text)' },
  { key: 'done', labelKey: 'done', color: 'var(--green-text)' },
]

export function MatrixPage() {
  const { language, t } = useI18n()
  const copy = t.matrix
  const [keywords, setKeywords] = useState<KeywordItem[]>([])
  const [focusType, setFocusType] = useState('')
  const [error, setError] = useState('')

  const rows: Array<{ key: KeywordType; label: string; badge: string }> = [
    { key: 'core', label: copy.rows.core, badge: 'b-core' },
    { key: 'longtail', label: copy.rows.longtail, badge: 'b-long' },
    { key: 'scenario', label: copy.rows.scenario, badge: 'b-scene' },
    { key: 'persona', label: copy.rows.persona, badge: 'b-customer' },
    { key: 'qa', label: copy.rows.qa, badge: 'b-question' },
    { key: 'competitor', label: copy.rows.competitor, badge: 'b-compete' },
    { key: 'brand', label: copy.rows.brand, badge: 'b-brand' },
  ]

  useEffect(() => {
    keywordsApi.list()
      .then((items) => {
        setKeywords(items)
        setError('')
      })
      .catch((issue: any) => setError(issue?.response?.data?.detail?.message || issue?.message || (language === 'zh' ? '矩阵加载失败。' : 'Failed to load matrix.')))
  }, [language])

  useEffect(() => {
    const draft = consumeWorkbenchTaskDraft('matrix')
    if (!draft?.prefill) return
    if (typeof draft.prefill.focusType === 'string') setFocusType(draft.prefill.focusType)
  }, [])

  const matrix = useMemo(
    () => rows.map((row) => ({ ...row, keywords: keywords.filter((item) => item.type === row.key) })),
    [keywords, rows],
  )

  const total = keywords.length
  const focusedCount = matrix.find((row) => row.key === focusType)?.keywords.length || 0

  return (
    <div id="page-matrix" className="page page-active">
      <div className="page-header linear-page-header">
        <div>
          <div className="page-title">{copy.title}</div>
          <div className="page-desc">{copy.desc}</div>
        </div>
        <div className="linear-header-meta">
          <span>{language === 'zh' ? '类型 x 状态' : 'Type x Status'}</span>
        </div>
      </div>

      <div className="page-body">
        {error ? <Alert tone="warn">{error}</Alert> : null}
        <div className="linear-workbench">
          <section className="linear-left">
            <div className="linear-panel-title">{language === 'zh' ? '摘要' : 'Summary'}</div>
            <div className="linear-metric-list">
              <div><span>{language === 'zh' ? '全部关键词' : 'All keywords'}</span><strong>{total}</strong></div>
              <div><span>{language === 'zh' ? '当前聚焦类型' : 'Focused type'}</span><strong>{focusType || '-'}</strong></div>
              <div><span>{language === 'zh' ? '聚焦词数' : 'Focused count'}</span><strong>{focusedCount}</strong></div>
            </div>
          </section>

          <section className="linear-main">
            <div id="matrix-view" className="matrix-view-stack">
              {matrix.map((row) => (
                <div key={row.key} className={`card ${focusType === row.key ? 'settings-ai-focus' : ''}`}>
                  <div className="card-header">
                    <div className="card-title">
                      <span className={`badge ${row.badge} matrix-badge`}>{row.label}</span>
                      {row.keywords.length} {copy.count}
                    </div>
                  </div>
                  <div className="matrix-grid">
                    {cols.map((col) => {
                      const items = row.keywords.filter((item) => item.status === col.key)
                      return (
                        <div key={`${row.key}-${col.key}`} className="matrix-col">
                          <div className="matrix-col-head" style={{ color: col.color }}>
                            {copy.cols[col.labelKey]} ({items.length})
                          </div>
                          {items.length ? items.map((item) => (
                            <div key={item.id} className="matrix-kw-item">{item.keyword}</div>
                          )) : (
                            <span className="muted-text">-</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="linear-right">
            <div className="linear-panel-title">{language === 'zh' ? '使用说明' : 'How to use'}</div>
            <div className="ai-home-principles">
              <div className="ai-home-principle">
                <strong>{language === 'zh' ? '先看分布' : 'Review distribution first'}</strong>
                <span>{language === 'zh' ? '先确认哪些类型仍集中在未分配状态。' : 'Start by checking which types are still concentrated in pending status.'}</span>
              </div>
              <div className="ai-home-principle">
                <strong>{language === 'zh' ? '再回到关键词库' : 'Then return to the library'}</strong>
                <span>{language === 'zh' ? '矩阵适合看结构，精细编辑建议回关键词库处理。' : 'The matrix is for structure; detailed editing is still best handled in the keyword library.'}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
