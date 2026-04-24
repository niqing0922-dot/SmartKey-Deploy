import { useState } from 'react'
import { aiApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'

export function AnalyzePage() {
  const { language, t } = useI18n()
  const copy = t.analyze
  const [keyword, setKeyword] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await aiApi.analyze({ keyword, context })
      setResult(data)
    } catch (issue: any) {
      setError(issue?.response?.data?.detail?.message || issue.message || copy.failed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id="page-analyze" className="page page-active">
      <div className="page-header linear-page-header">
        <div><div className="page-title">{copy.title}</div><div className="page-desc">{copy.desc}</div></div>
        <div className="linear-header-meta"><span>{language === 'zh' ? '深度分析' : 'Deep analysis'}</span></div>
      </div>

      <div className="page-body linear-workbench ai-linear-workbench">
        <section className="linear-left">
          <div className="linear-panel-title">{language === 'zh' ? '输入' : 'Input'}</div>
          <div className="linear-inspector-grid">
            <div className="field-block"><label>{copy.keyword}</label><input type="text" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={copy.keywordPlaceholder} /></div>
            <div className="field-block"><label>{copy.context}</label><input type="text" value={context} onChange={(event) => setContext(event.target.value)} placeholder={copy.contextPlaceholder} /></div>
          </div>
          <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}>{loading ? copy.loading : copy.submit}</button>
          {error ? <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div> : null}
        </section>

        <section className="linear-main ai-main-panel">
          {!result ? <div className="empty-state">{copy.summaryEmpty}</div> : (
            <>
              <div className="analysis-stats-row">
                <div className="stat-card"><div className="stat-num analysis-stat-num">{result.searchVolume || '—'}</div><div className="stat-label">{copy.searchVolume}</div></div>
                <div className="stat-card"><div className="stat-num analysis-stat-num">{result.difficulty || '—'}</div><div className="stat-label">{copy.difficulty}</div></div>
                <div className="stat-card"><div className="stat-num analysis-stat-num">{result.intent || '—'}</div><div className="stat-label">{copy.intent}</div></div>
              </div>
              <div className="analysis-block"><strong>{copy.summary}</strong><p>{result.summary || copy.summaryEmpty}</p></div>
              <div className="analysis-two-col">
                <div className="analysis-block"><strong>{copy.audience}</strong><p>{result.audience || copy.audienceEmpty}</p></div>
                <div className="analysis-block"><strong>{copy.deploymentGuide}</strong><p>{result.intent || '—'}</p></div>
              </div>
            </>
          )}
        </section>

        <section className="linear-right">
          <div className="linear-panel-title">{copy.related}</div>
          <div className="analysis-related-wrap">
            {(result?.suggestions || []).length ? result.suggestions.map((item: string, index: number) => <span key={index} className="chip sel">{item}</span>) : <span className="muted-text">{copy.noSuggestions}</span>}
          </div>
        </section>
      </div>
    </div>
  )
}
