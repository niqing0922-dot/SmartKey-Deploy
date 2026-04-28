import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Alert, EmptyState } from '@/components/ui/States'
import { useI18n } from '@/i18n/useI18n'
import { consumeWorkbenchTaskDraft } from '@/lib/workbenchDrafts'
import { geoWriterApi, keywordsApi, settingsApi } from '@/services/api'
import type { ContentLanguage, GeoDraftItem, KeywordItem, SettingsItem } from '@/types'

const contentLanguageOptions: Array<{ value: ContentLanguage; label: string }> = [
  { value: 'zh', label: 'ZH - 中文' },
  { value: 'en', label: 'EN - English' },
  { value: 'de', label: 'DE - Deutsch' },
  { value: 'es', label: 'ES - Espanol' },
  { value: 'fr', label: 'FR - Francais' },
]

const defaultContentBlocks = ['table_of_contents', 'introduction', 'technical_sections', 'use_cases', 'faq']
const targetLengthOptions = [600, 1000, 1500, 2500, 3500, 5000]

const emptyForm = {
  title: '',
  primary_keyword: '',
  secondary_keywords: '',
  audience: '',
  industry: '',
  target_market: '',
  article_type: 'blog',
  tone: '',
  target_length: 1000,
  content_language: 'zh' as ContentLanguage,
  content_blocks: defaultContentBlocks,
}

function ensureOutlineList(value: unknown) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object' && Array.isArray((value as { sections?: unknown[] }).sections)) {
    return (value as { sections: unknown[] }).sections
  }
  return []
}

function ensureDraftSections(value: unknown) {
  return Array.isArray(value) ? value : []
}

function ensureFaqItems(value: unknown) {
  return Array.isArray(value) ? value : []
}

function getDraftLanguage(draft: GeoDraftItem | null) {
  const value = draft?.brief?.content_language
  return typeof value === 'string' ? value.toUpperCase() : ''
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export function GeoWriterPage() {
  const { t, language } = useI18n()
  const copy = t.geoWriter
  const common = t.common

  const [drafts, setDrafts] = useState<GeoDraftItem[]>([])
  const [selected, setSelected] = useState<GeoDraftItem | null>(null)
  const [settings, setSettings] = useState<SettingsItem | null>(null)
  const [keywords, setKeywords] = useState<KeywordItem[]>([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<'md' | 'docx' | ''>('')

  const articleTypeOptions = [
    { value: 'blog', label: copy.typeOptions.blog },
    { value: 'guide', label: copy.typeOptions.guide },
    { value: 'compare', label: copy.typeOptions.compare },
    { value: 'case', label: copy.typeOptions.case },
    { value: 'faq', label: copy.typeOptions.faq },
    { value: 'landing', label: copy.typeOptions.landing },
  ]

  const contentBlockOptions = [
    { value: 'table_of_contents', label: copy.contentBlocksOptions.table_of_contents },
    { value: 'introduction', label: copy.contentBlocksOptions.introduction },
    { value: 'technical_sections', label: copy.contentBlocksOptions.technical_sections },
    { value: 'use_cases', label: copy.contentBlocksOptions.use_cases },
    { value: 'feature_highlights', label: copy.contentBlocksOptions.feature_highlights },
    { value: 'faq', label: copy.contentBlocksOptions.faq },
    { value: 'cta', label: copy.contentBlocksOptions.cta },
  ]

  const load = async () => {
    try {
      const [draftList, nextSettings, keywordList] = await Promise.all([
        geoWriterApi.list(),
        settingsApi.get(),
        keywordsApi.list(),
      ])
      setDrafts(draftList)
      setSelected(draftList[0] || null)
      setSettings(nextSettings)
      setKeywords(keywordList)
      setForm((current) => ({
        ...current,
        content_language: nextSettings.default_content_language || current.content_language,
      }))
    } catch (issue: any) {
      const detail = issue?.response?.data?.detail
      setError(detail?.message || issue.message || copy.loadFailed)
      setDrafts([])
      setSelected(null)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const draft = consumeWorkbenchTaskDraft('articles.geo-writer')
    if (draft?.prefill) {
      const title = typeof draft.prefill.title === 'string' ? draft.prefill.title : ''
      const primaryKeyword = typeof draft.prefill.primary_keyword === 'string' ? draft.prefill.primary_keyword : title
      setForm((current) => ({
        ...current,
        title: title || current.title,
        primary_keyword: primaryKeyword || current.primary_keyword,
        secondary_keywords: typeof draft.prefill.secondary_keywords === 'string'
          ? draft.prefill.secondary_keywords
          : (primaryKeyword || current.secondary_keywords),
        industry: typeof draft.prefill.industry === 'string' ? draft.prefill.industry : current.industry,
        article_type: typeof draft.prefill.article_type === 'string' ? draft.prefill.article_type : current.article_type,
        target_length: typeof draft.prefill.target_length === 'number' ? draft.prefill.target_length : current.target_length,
        content_language: typeof draft.prefill.content_language === 'string'
          ? draft.prefill.content_language as ContentLanguage
          : current.content_language,
      }))
      return
    }

    const raw = window.localStorage.getItem('smartkey.global.geo')
    if (!raw) return
    try {
      const legacy = JSON.parse(raw)
      const title = typeof legacy.title === 'string' ? legacy.title : ''
      const primaryKeyword = typeof legacy.primary_keyword === 'string' ? legacy.primary_keyword : title
      setForm((current) => ({
        ...current,
        title: title || current.title,
        primary_keyword: primaryKeyword || current.primary_keyword,
        secondary_keywords: primaryKeyword || current.secondary_keywords,
      }))
    } finally {
      window.localStorage.removeItem('smartkey.global.geo')
    }
  }, [])

  const generate = async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const draft = await geoWriterApi.generate({
        title: form.title,
        primary_keyword: form.primary_keyword || form.title,
        secondary_keywords: form.secondary_keywords.split(',').map((item) => item.trim()).filter(Boolean),
        audience: form.audience,
        industry: form.industry,
        target_market: form.target_market || settings?.default_market,
        article_type: form.article_type,
        tone: form.tone || settings?.default_tone,
        target_length: Number(form.target_length),
        content_language: form.content_language,
        content_blocks: form.content_blocks,
      })
      await load()
      setSelected(draft)
      setMessage(copy.generated)
    } catch (issue: any) {
      const detail = issue?.response?.data?.detail
      if (detail?.code === 'configuration_required') {
        setError(copy.configurationRequired.replace('{provider}', detail.provider))
      } else {
        setError(detail?.message || issue.message || copy.generateFailed)
      }
    } finally {
      setLoading(false)
    }
  }

  const saveDraft = async () => {
    if (!selected) return
    setError('')
    setMessage('')
    try {
      await geoWriterApi.save(selected.id)
      await load()
      setMessage(copy.saved)
    } catch (issue: any) {
      const detail = issue?.response?.data?.detail
      setError(detail?.message || issue.message || copy.saveFailed)
    }
  }

  const exportDraft = async (format: 'md' | 'docx') => {
    if (!selected) return
    setExporting(format)
    setError('')
    setMessage('')
    try {
      const blob = format === 'md'
        ? await geoWriterApi.exportMarkdown(selected.id)
        : await geoWriterApi.exportWord(selected.id)
      downloadBlob(blob, `${selected.title}.${format}`)
      setMessage(format === 'md' ? copy.markdownExported : copy.wordExported)
    } catch (issue: any) {
      const detail = issue?.response?.data?.detail
      setError(detail?.message || issue.message || copy.exportFailed)
    } finally {
      setExporting('')
    }
  }

  const addKeywordChip = (keyword: string) => {
    const current = form.secondary_keywords.split(',').map((item) => item.trim()).filter(Boolean)
    if (current.includes(keyword)) return
    setForm({ ...form, secondary_keywords: [...current, keyword].join(', ') })
  }

  const toggleContentBlock = (value: string) => {
    setForm((current) => ({
      ...current,
      content_blocks: current.content_blocks.includes(value)
        ? current.content_blocks.filter((item) => item !== value)
        : [...current.content_blocks, value],
    }))
  }

  const outlineItems = ensureOutlineList(selected?.outline)
  const draftSections = ensureDraftSections(selected?.draft_sections)
  const faqItems = ensureFaqItems(selected?.faq)

  const tableOfContents = useMemo(() => {
    if (outlineItems.length) return outlineItems
    return draftSections.map((section: any) => section.heading || copy.sectionFallback)
  }, [outlineItems, draftSections, copy.sectionFallback])

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') return
      if (!drafts.length) return

      const currentIndex = Math.max(drafts.findIndex((item) => item.id === selected?.id), 0)
      if (event.key.toLowerCase() === 'j' || event.key === 'ArrowDown') {
        event.preventDefault()
        setSelected(drafts[Math.min(currentIndex + 1, drafts.length - 1)])
      }
      if (event.key.toLowerCase() === 'k' || event.key === 'ArrowUp') {
        event.preventDefault()
        setSelected(drafts[Math.max(currentIndex - 1, 0)])
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [drafts, selected])

  return (
    <div id="page-aiwrite" className="page page-active">
      <PageHeader
        title={copy.title}
        description={copy.desc}
        actions={
          <div className="linear-header-meta">
            <span>{language === 'zh' ? '三栏写作流' : 'Three-panel writing flow'}</span>
            <span>J / K</span>
          </div>
        }
      />

      <div className="page-body">
        {error ? <Alert tone="warn">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}

        <div className="linear-workbench geo-linear-workbench">
          <section className="linear-left geo-left-panel">
            <Card>
              <div className="linear-panel-title">{copy.settingsTitle}</div>
              <div className="linear-inspector-grid">
                <Field label={copy.articleTitle}>
                  <input
                    data-testid="geo.title-input"
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder={copy.articleTitlePlaceholder}
                  />
                </Field>
                <Field label={copy.keywords}>
                  <textarea
                    rows={4}
                    value={form.secondary_keywords}
                    onChange={(event) => setForm({ ...form, secondary_keywords: event.target.value })}
                    placeholder={copy.keywordsPlaceholder}
                  />
                </Field>
                <Field label={copy.industry}>
                  <input
                    value={form.industry}
                    onChange={(event) => setForm({ ...form, industry: event.target.value })}
                    placeholder={copy.industryPlaceholder}
                  />
                </Field>
                <Field label={copy.articleType}>
                  <select value={form.article_type} onChange={(event) => setForm({ ...form, article_type: event.target.value })}>
                    {articleTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label={copy.targetLength}>
                  <select value={String(form.target_length)} onChange={(event) => setForm({ ...form, target_length: Number(event.target.value) })}>
                    {targetLengthOptions.map((option) => (
                      <option key={option} value={option}>~{option}</option>
                    ))}
                  </select>
                </Field>
                <Field label={copy.contentLanguage}>
                  <select value={form.content_language} onChange={(event) => setForm({ ...form, content_language: event.target.value as ContentLanguage })}>
                    {contentLanguageOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label={copy.contentBlocks}>
                  <div className="aw-section-picker">
                    {contentBlockOptions.map((option) => (
                      <span
                        key={option.value}
                        className={`chip ${form.content_blocks.includes(option.value) ? 'sel' : ''}`}
                        onClick={() => toggleContentBlock(option.value)}
                      >
                        {option.label}
                      </span>
                    ))}
                  </div>
                </Field>
                <Field label={copy.pickFromLibrary}>
                  <div className="aw-kw-chips">
                    {!keywords.length ? (
                      <span className="muted-text">{copy.emptyKeywordLibrary}</span>
                    ) : keywords.slice(0, 40).map((item) => (
                      <span key={item.id} className="chip" onClick={() => addKeywordChip(item.keyword)}>
                        {item.keyword}
                      </span>
                    ))}
                  </div>
                </Field>
              </div>
              <button
                id="btn-aw"
                data-testid="geo.generate-button"
                className="btn btn-primary btn-full"
                onClick={generate}
                disabled={loading}
              >
                {loading ? common.generating : copy.generate}
              </button>
            </Card>
          </section>

          <section className="linear-main geo-main-panel">
            {!selected ? (
              <div id="aw-output" className="aw-output aw-output-empty">
                <Card>
                  <EmptyState
                    title={language === 'zh' ? '还没有文章草稿' : 'No draft yet'}
                    description={copy.emptyState}
                  />
                </Card>
              </div>
            ) : (
              <>
                <div className="aiwrite-output-meta">
                  <div className="muted-text">
                    {selected.provider} / {selected.target_length} / {getDraftLanguage(selected) || form.content_language.toUpperCase()}
                  </div>
                  <div className="btn-group">
                    <button className="btn btn-sm" onClick={() => navigator.clipboard.writeText(JSON.stringify(selected, null, 2))}>
                      {common.copyFull}
                    </button>
                    <button className="btn btn-sm" onClick={() => exportDraft('md')} disabled={exporting === 'md'}>
                      {exporting === 'md' ? common.exportMdBusy : common.exportMd}
                    </button>
                    <button className="btn btn-sm" onClick={() => exportDraft('docx')} disabled={exporting === 'docx'}>
                      {exporting === 'docx' ? common.exportMdBusy : common.exportWord}
                    </button>
                    <button className="btn btn-sm btn-success" data-testid="geo.save-button" onClick={saveDraft}>
                      {common.saveToArticles}
                    </button>
                  </div>
                </div>

                <div id="aw-output" className="aw-output aw-post-output">
                  <div className="aw-post-shell aw-output-stack">
                    <div className="aw-post-head">
                      <div className="aw-post-meta muted-text">{common.adminMeta}</div>
                      <h1>{selected.title}</h1>
                    </div>
                    {tableOfContents.length ? (
                      <div className="aw-section aw-toc-section">
                        <h3>{copy.toc}</h3>
                        <ol>
                          {tableOfContents.map((section: any, index: number) => (
                            <li key={index}>
                              {typeof section === 'string' ? section : section.heading || JSON.stringify(section)}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    <div className="aw-section">
                      <h3>{copy.metaDescription}</h3>
                      <p>{selected.meta_description || '-'}</p>
                    </div>
                    <div className="aw-section">
                      <h3>{copy.metaTitle}</h3>
                      <p>{selected.meta_title || '-'}</p>
                    </div>
                    <div className="aw-section">
                      <h3>{copy.draftSections}</h3>
                      {draftSections.length ? draftSections.map((section: any, index: number) => (
                        <div key={`${section.heading || 'section'}-${index}`} className="aw-draft-section">
                          <h4>{section.heading || `${copy.sectionFallback} ${index + 1}`}</h4>
                          <p>{section.content || ''}</p>
                        </div>
                      )) : (
                        <div className="aw-draft-section"><p>-</p></div>
                      )}
                    </div>
                    <div className="aw-section">
                      <h3>{copy.faq}</h3>
                      {faqItems.length ? faqItems.map((item: any, index: number) => (
                        <div key={index} className="aw-draft-section">
                          <strong>{item.question || `${copy.faqFallback} ${index + 1}`}</strong>
                          <p>{item.answer || ''}</p>
                        </div>
                      )) : (
                        <div className="aw-draft-section"><p>-</p></div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="linear-right geo-right-panel">
            <Card>
              <div className="linear-panel-title">{copy.history}</div>
              <div className="geo-history-list">
                {!drafts.length ? (
                  <span className="muted-text">{copy.noHistory}</span>
                ) : drafts.map((draft) => (
                  <button
                    key={draft.id}
                    className={`draft-item geo-history-item ${selected?.id === draft.id ? 'active' : ''}`}
                    onClick={() => setSelected(draft)}
                  >
                    <strong className="geo-history-title" title={draft.title}>{draft.title}</strong>
                    <span className="muted-text">{draft.provider} / {new Date(draft.created_at).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </Card>
          </section>
        </div>
      </div>
    </div>
  )
}
