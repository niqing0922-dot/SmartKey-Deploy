import { useEffect, useMemo, useState } from 'react'
import { aiApi, articlesApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'
import type { ArticleItem, ImagePlanItem } from '@/types'

const styleOptions = [
  'Clean product marketing',
  'Industrial photography',
  '3D product render',
  'Technical diagram',
  'Editorial hero image',
  'Isometric workflow illustration',
  'Minimal flat illustration',
  'Cinematic factory scene',
]

export function ImagePlannerPage() {
  const { t } = useI18n()
  const copy = t.imagePlanner
  const [articles, setArticles] = useState<ArticleItem[]>([])
  const [selectedArticleId, setSelectedArticleId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [style, setStyle] = useState(styleOptions[0])
  const [count, setCount] = useState('6')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<ImagePlanItem[]>([])

  useEffect(() => {
    articlesApi.list().then(setArticles).catch(() => setArticles([]))
  }, [])

  const selectedArticle = useMemo(() => articles.find((item) => item.id === selectedArticleId) || null, [articles, selectedArticleId])

  const importArticle = () => {
    if (!selectedArticle) return
    setTitle(selectedArticle.title)
    setContent(selectedArticle.content)
    setMessage(copy.imported)
    setError('')
  }

  const analyze = async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const result = await aiApi.imagePlan({
        article_title: title,
        article_content: content,
        desired_style: style,
        image_count: Number(count),
      })
      setItems(result.items || [])
      setMessage(copy.analyzed)
    } catch (issue: any) {
      const detail = issue?.response?.data?.detail
      setError(detail?.message || issue.message || copy.failed)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id="page-image-planner" className="page page-active">
      <div className="page-header">
        <div>
          <div className="page-title">{copy.title}</div>
          <div className="page-desc">{copy.desc}</div>
        </div>
      </div>

      <div className="page-body">
        {error ? <div className="alert alert-warn">{error}</div> : null}
        {message ? <div className="alert alert-success">{message}</div> : null}
        <div className="aiwrite-layout">
          <div className="aiwrite-sidebar">
            <div className="card aiwrite-card">
              <div className="card-header"><div className="card-title">{copy.importCard}</div></div>
              <div className="aiwrite-field">
                <label>{copy.importFromArticles}</label>
                <select value={selectedArticleId} onChange={(event) => setSelectedArticleId(event.target.value)}>
                  <option value="">{copy.chooseSaved}</option>
                  {articles.map((article) => <option key={article.id} value={article.id}>{article.title}</option>)}
                </select>
              </div>
              <button className="btn btn-full" type="button" onClick={importArticle} disabled={!selectedArticle}>{copy.importSelected}</button>
              <div className="aiwrite-field" style={{ marginTop: 12 }}>
                <label>{copy.articleTitle}</label>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.articleTitlePlaceholder} />
              </div>
              <div className="aiwrite-field">
                <label>{copy.articleContent}</label>
                <textarea value={content} onChange={(event) => setContent(event.target.value)} style={{ minHeight: 240, fontSize: 12 }} placeholder={copy.articleContentPlaceholder}></textarea>
              </div>
            </div>

            <div className="card aiwrite-card">
              <div className="card-header"><div className="card-title">{copy.optionsCard}</div></div>
              <div className="aiwrite-field">
                <label>{copy.style}</label>
                <select value={style} onChange={(event) => setStyle(event.target.value)}>
                  {styleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div className="aiwrite-field">
                <label>{copy.imageCount}</label>
                <select value={count} onChange={(event) => setCount(event.target.value)}>
                  <option value="4">4</option>
                  <option value="6">6</option>
                  <option value="8">8</option>
                  <option value="10">10</option>
                </select>
              </div>
              <button className="btn btn-primary btn-full" type="button" onClick={analyze} disabled={loading || !title.trim() || !content.trim()}>{loading ? copy.analyzing : copy.analyze}</button>
            </div>
          </div>

          <div className="aiwrite-output-column">
            <div className="card aiwrite-card image-plan-card">
              <div className="card-header"><div className="card-title">{copy.resultCard}</div></div>
              {!items.length ? <div className="empty-state">{copy.empty}</div> : (
                <div className="image-plan-list">
                  {items.map((item, index) => (
                    <div key={`${item.section}-${index}`} className="image-plan-item">
                      <div className="image-plan-head">
                        <div>
                          <div className="image-plan-title">{item.section}</div>
                          <div className="muted-text">{item.image_type} · {item.style}</div>
                        </div>
                        <span className="badge badge-planned">{copy.suggested}</span>
                      </div>
                      <div className="analysis-block"><strong>{copy.why}</strong><p>{item.reason}</p></div>
                      <div className="analysis-block"><strong>{copy.prompt}</strong><p>{item.prompt}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
