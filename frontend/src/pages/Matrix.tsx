import { useEffect, useMemo, useState } from 'react'
import { keywordsApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'
import type { KeywordItem, KeywordStatus, KeywordType } from '@/types'

export function MatrixPage() {
  const { t } = useI18n()
  const copy = t.matrix
  const rows: Array<{ key: KeywordType; label: string; badge: string }> = [ { key: 'core', label: copy.rows.core, badge: 'b-core' }, { key: 'longtail', label: copy.rows.longtail, badge: 'b-long' }, { key: 'scenario', label: copy.rows.scenario, badge: 'b-scene' }, { key: 'persona', label: copy.rows.persona, badge: 'b-customer' }, { key: 'qa', label: copy.rows.qa, badge: 'b-question' }, { key: 'competitor', label: copy.rows.competitor, badge: 'b-compete' }, { key: 'brand', label: copy.rows.brand, badge: 'b-brand' } ]
  const cols: Array<{ key: KeywordStatus; label: string; color: string }> = [ { key: 'pending', label: copy.cols.pending, color: 'var(--text-3)' }, { key: 'planned', label: copy.cols.planned, color: 'var(--blue-text)' }, { key: 'done', label: copy.cols.done, color: 'var(--green-text)' } ]
  const [keywords, setKeywords] = useState<KeywordItem[]>([])
  useEffect(() => { keywordsApi.list().then(setKeywords) }, [])
  const matrix = useMemo(() => rows.map((row) => ({ ...row, keywords: keywords.filter((item) => item.type === row.key) })), [keywords, rows])
  return <div id="page-matrix" className="page page-active"><div className="page-header"><div><div className="page-title">{copy.title}</div><div className="page-desc">{copy.desc}</div></div></div><div className="page-body"><div id="matrix-view" className="matrix-view-stack">{matrix.map((row) => <div key={row.key} className="card"><div className="card-header"><div className="card-title"><span className={`badge ${row.badge} matrix-badge`}>{row.label}</span> {row.keywords.length} {copy.count}</div></div><div className="matrix-grid">{cols.map((col) => { const items = row.keywords.filter((item) => item.status === col.key); return <div key={`${row.key}-${col.key}`} className="matrix-col"><div className="matrix-col-head" style={{ color: col.color }}>{col.label} ({items.length})</div>{items.length ? items.map((item) => <div key={item.id} className="matrix-kw-item">{item.keyword}</div>) : <span className="muted-text">—</span>}</div> })}</div></div>)}</div></div></div>
}
