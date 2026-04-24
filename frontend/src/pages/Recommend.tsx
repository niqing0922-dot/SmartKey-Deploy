import { useEffect, useMemo, useState } from 'react'
import { aiApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'

export function RecommendPage() {
  const { language, t } = useI18n()
  const copy = t.recommend
  const typeOptions = copy.typeOptions
  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')
  const [count, setCount] = useState('12')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(typeOptions.slice(0, 4))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    setSelectedTypes(typeOptions.slice(0, 4))
  }, [language, typeOptions])

  const hasSelection = useMemo(() => new Set(selectedTypes), [selectedTypes])

  const toggleType = (type: string) => {
    setSelectedTypes((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]))
  }

  const formatCount = (value: string) => (copy.countSuffix ? `${value} ${copy.countSuffix}` : value)

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await aiApi.recommend({ title, context, count: Number(count), types: selectedTypes })
      setItems(result.items || [])
    } catch (issue: any) {
      setError(issue?.response?.data?.detail?.message || issue.message || copy.failed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id="page-recommend" className="page page-active">
      <div className="page-header linear-page-header">
        <div><div className="page-title">{copy.title}</div><div className="page-desc">{copy.desc}</div></div>
        <div className="linear-header-meta"><span>⌘K</span><span>{items.length} items</span></div>
      </div>

      <div className="page-body linear-workbench ai-linear-workbench">
        <section className="linear-left">
          <div className="linear-panel-title">{copy.cardTitle}</div>
          <div className="linear-inspector-grid">
            <div className="field-block"><label>{copy.articleTitle}</label><input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.articleTitlePlaceholder} /></div>
            <div className="field-block"><label>{copy.context}</label><input type="text" value={context} onChange={(event) => setContext(event.target.value)} placeholder={copy.contextPlaceholder} /></div>
            <div className="field-block"><label>{copy.count}</label><select value={count} onChange={(event) => setCount(event.target.value)}><option value="8">{formatCount('8')}</option><option value="12">{formatCount('12')}</option><option value="15">{formatCount('15')}</option><option value="20">{formatCount('20')}</option><option value="30">{formatCount('30')}</option><option value="50">{formatCount('50')}</option><option value="100">{formatCount('100')}</option></select></div>
            <div className="field-block"><label>{copy.types}</label><div className="aw-section-picker">{typeOptions.map((type) => <span key={type} className={`chip ${hasSelection.has(type) ? 'sel' : ''}`} onClick={() => toggleType(type)}>{type}</span>)}</div></div>
          </div>
          <button id="btn-rec" className="btn btn-primary btn-full" onClick={submit} disabled={loading}>{loading ? copy.loading : copy.submit}</button>
          {error ? <div className="alert alert-warn" style={{ marginTop: 10 }}>{error}</div> : null}
        </section>

        <section className="linear-main ai-main-panel">
          <div className="linear-table-wrap">
            <table className="tbl linear-table">
              <thead><tr><th>Keyword</th><th>Type</th><th>Reason</th><th>Action</th></tr></thead>
              <tbody>
                {!items.length ? <tr><td colSpan={4}><div className="empty">{copy.resultTitle}</div></td></tr> : items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.keyword || item.title || `${copy.resultTitle} ${index + 1}`}</td>
                    <td>{item.type || item.intent || copy.fallbackReason}</td>
                    <td>{item.reason || item.description || '-'}</td>
                    <td><button className="btn btn-xs">{copy.addToLibrary}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="linear-right">
          <div className="linear-panel-title">{language === 'zh' ? '运行摘要' : 'Run Summary'}</div>
          <div className="linear-metric-list">
            <div><span>{language === 'zh' ? '候选词' : 'Candidates'}</span><strong>{items.length}</strong></div>
            <div><span>{language === 'zh' ? '类型数' : 'Types'}</span><strong>{selectedTypes.length}</strong></div>
            <div><span>{language === 'zh' ? '建议数量' : 'Target count'}</span><strong>{count}</strong></div>
          </div>
        </section>
      </div>
    </div>
  )
}
