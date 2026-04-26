import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiApi, indexingApi, settingsApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'
import { Alert, EmptyState } from '@/components/ui/States'
import { consumeWorkbenchTaskDraft } from '@/lib/workbenchDrafts'
import type { IndexingPrepareResult, SettingsItem } from '@/types'

type IndexingRow = {
  url: string
  indexed?: boolean | null
  coverage?: string
  indexing_state?: string
  last_crawl?: string
  error?: string
  checked_at?: string
  success?: boolean | null
  status_message?: string
  retry_count?: number | null
}

type UploadedSource = {
  filename: string
  content: string
}

function toCsvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function parseUrlsLocally(text: string): string[] {
  if (!text.trim()) return []
  const urls: string[] = []
  const seen = new Set<string>()

  const locMatches = text.match(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi) || []
  locMatches.forEach((item) => {
    const match = item.replace(/<\/?loc>/gi, '').trim()
    if (match && !seen.has(match)) {
      seen.add(match)
      urls.push(match)
    }
  })

  const regexMatches = text.match(/https?:\/\/[^\s"'<>]+/gi) || []
  regexMatches.forEach((item) => {
    const url = item.trim().replace(/[;,]$/, '')
    if (url && !seen.has(url)) {
      seen.add(url)
      urls.push(url)
    }
  })

  return urls
}

function inferSiteUrlFromInput(siteUrl: string, urls: string[]): string {
  const trimmed = siteUrl.trim()
  if (trimmed) return trimmed
  const first = urls[0]
  if (!first) return ''
  try {
    const parsed = new URL(first)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return ''
  }
}

function readErrorMessage(issue: any, fallback: string) {
  const detail = issue?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail?.message) return detail.message
  return issue?.message || fallback
}

function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function IndexingPage() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const copy = t.indexing

  const [settings, setSettings] = useState<SettingsItem | null>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [jobsStatus, setJobsStatus] = useState('')
  const [jobsMessage, setJobsMessage] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [pages, setPages] = useState<IndexingRow[]>([])

  const [siteUrl, setSiteUrl] = useState('')
  const [urlsText, setUrlsText] = useState('')
  const [urlFilePath, setUrlFilePath] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [uploadedText, setUploadedText] = useState('')
  const [parseSource, setParseSource] = useState<'none' | 'local' | 'ai'>('none')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [prepareSources, setPrepareSources] = useState<UploadedSource[]>([])
  const [prepareResult, setPrepareResult] = useState<IndexingPrepareResult | null>(null)
  const [preparing, setPreparing] = useState(false)

  const [action, setAction] = useState<'inspect' | 'submit'>('submit')
  const [maxPages, setMaxPages] = useState('50')
  const [crawlDelay, setCrawlDelay] = useState('0.5')
  const [checkDelay, setCheckDelay] = useState('0.3')
  const [submissionType, setSubmissionType] = useState<'URL_UPDATED' | 'URL_DELETED'>('URL_UPDATED')
  const [maxRetries, setMaxRetries] = useState('3')

  const [running, setRunning] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [error, setError] = useState('')

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'indexed' | 'not_indexed' | 'error'>('all')
  const [pageSize, setPageSize] = useState('20')
  const [pageIndex, setPageIndex] = useState(1)

  const hasGoogleCreds = Boolean(settings?.google_credentials_path_configured || settings?.google_credentials_path)
  const indexingEnabled = Boolean(settings?.indexing_enabled)
  const isReady = hasGoogleCreds && indexingEnabled

  const urls = useMemo(() => {
    const seen = new Set<string>()
    return urlsText
      .split('\n')
      .map((item) => item.trim())
      .filter((item) => {
        if (!item || seen.has(item)) return false
        seen.add(item)
        return true
      })
  }, [urlsText])

  const inputSiteUrl = inferSiteUrlFromInput(siteUrl, urls)
  const hasInput = Boolean(inputSiteUrl || urls.length || urlFilePath.trim())
  const canRun = isReady && hasInput && !running

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pages.filter((item) => {
      const indexed = item.indexed === true
      const hasError = Boolean(item.error)
      const statusPass =
        statusFilter === 'all'
          ? true
          : statusFilter === 'indexed'
            ? indexed
            : statusFilter === 'not_indexed'
              ? item.indexed === false
              : hasError
      if (!statusPass) return false
      if (!q) return true
      return [item.url, item.coverage, item.indexing_state, item.status_message, item.error]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [pages, query, statusFilter])

  const totalPages = useMemo(() => {
    const size = Math.max(1, Number(pageSize) || 20)
    return Math.max(1, Math.ceil(filteredPages.length / size))
  }, [filteredPages.length, pageSize])

  const pagedPages = useMemo(() => {
    const size = Math.max(1, Number(pageSize) || 20)
    const safePage = Math.min(pageIndex, totalPages)
    const start = (safePage - 1) * size
    return filteredPages.slice(start, start + size)
  }, [filteredPages, pageIndex, pageSize, totalPages])

  const lastRunAt = jobs[0]?.finished_at || jobs[0]?.created_at || ''
  const startButtonLabel = action === 'submit' ? copy.startSubmit : copy.startInspect
  const runningLabel = action === 'submit' ? copy.runningSubmit : copy.runningInspect

  const loadJobs = async (keepSelection = true) => {
    const data = await indexingApi.jobs()
    const items = data?.items || []
    setJobs(items)
    setJobsStatus(data?.status || '')
    setJobsMessage(data?.message || '')
    const nextId = keepSelection ? selectedJobId || items[0]?.id || '' : items[0]?.id || ''
    setSelectedJobId(nextId)
    if (nextId) {
      const pagesData = await indexingApi.pages(nextId)
      setPages(pagesData?.items || [])
    } else {
      setPages([])
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const settingData = await settingsApi.get()
        if (!cancelled) setSettings(settingData)
      } catch (issue: any) {
        if (!cancelled) setError(readErrorMessage(issue, copy.settingsLoadFailed))
      }
      try {
        await loadJobs(false)
      } catch (issue: any) {
        if (!cancelled) setError(readErrorMessage(issue, copy.jobsLoadFailed))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const draft = consumeWorkbenchTaskDraft('indexing')
    if (draft?.prefill) {
      const draftUrls = Array.isArray(draft.prefill.urls) ? draft.prefill.urls.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
      if (draftUrls.length) {
        setUrlsText(draftUrls.join('\n'))
        try {
          const first = new URL(draftUrls[0])
          setSiteUrl(`${first.protocol}//${first.host}`)
        } catch {
          setSiteUrl('')
        }
      }
      if (draft.prefill.action === 'inspect' || draft.prefill.action === 'submit') setAction(draft.prefill.action)
      setParseSource('local')
      return
    }
    const raw = window.localStorage.getItem('smartkey.global.indexing')
    if (!raw) return
    try {
      const legacy = JSON.parse(raw)
      const draftUrls = Array.isArray(legacy.urls) ? legacy.urls.filter((item: unknown) => typeof item === 'string' && item.trim()) : []
      if (draftUrls.length) {
        setUrlsText(draftUrls.join('\n'))
        try {
          const first = new URL(draftUrls[0])
          setSiteUrl(`${first.protocol}//${first.host}`)
        } catch {
          setSiteUrl('')
        }
      }
      if (legacy.action === 'inspect' || legacy.action === 'submit') setAction(legacy.action)
      setParseSource('local')
    } finally {
      window.localStorage.removeItem('smartkey.global.indexing')
    }
  }, [])

  useEffect(() => {
    if (!selectedJobId) return
    indexingApi
      .pages(selectedJobId)
      .then((data) => setPages(data?.items || []))
      .catch(() => setPages([]))
  }, [selectedJobId])

  useEffect(() => {
    setPageIndex(1)
  }, [query, statusFilter, pageSize, pages])

  const handlePrepareUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    const nextSources = await Promise.all(files.map(async (file) => ({ filename: file.name, content: await file.text() })))
    setPrepareSources(nextSources)
    setPrepareResult(null)
    setError('')
  }

  const prepareFromFiles = async () => {
    if (!prepareSources.length) {
      setError(copy.uploadFirst)
      return
    }
    setPreparing(true)
    setError('')
    try {
      const result = await indexingApi.prepare({ sources: prepareSources })
      setPrepareResult(result)
    } catch (issue: any) {
      setError(readErrorMessage(issue, copy.prepareFailed))
    } finally {
      setPreparing(false)
    }
  }

  const usePreparedUrls = () => {
    if (!prepareResult?.submit_ready_urls?.length) return
    setUrlsText(prepareResult.submit_ready_urls.join('\n'))
    setAction('submit')
    setParseSource('local')
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setUploadedFileName(file.name)
    setUploadedText(text)
    const localUrls = parseUrlsLocally(text)
    if (localUrls.length) {
      setUrlsText(localUrls.join('\n'))
      setParseSource('local')
      setError('')
    } else {
      setParseSource('none')
      setError(copy.localParseFailed)
    }
  }

  const handleAiFallback = async () => {
    if (!uploadedText.trim()) {
      setError(copy.uploadFirst)
      return
    }
    setAiProcessing(true)
    setError('')
    try {
      const result = await aiApi.indexingUrlExtract({ text: uploadedText, filename: uploadedFileName })
      const aiUrls = result?.urls || []
      if (!aiUrls.length) {
        setError(copy.aiNoUrls)
        return
      }
      setUrlsText(aiUrls.join('\n'))
      setParseSource('ai')
    } catch {
      setError(copy.aiParseFailed)
    } finally {
      setAiProcessing(false)
    }
  }

  const run = async () => {
    if (!canRun) return
    setRunning(true)
    setError('')
    try {
      const result = await indexingApi.run({
        action,
        site_url: inputSiteUrl,
        urls,
        url_file_path: urlFilePath.trim(),
        max_pages: Number(maxPages) || 50,
        crawl_delay: Number(crawlDelay) || 0.5,
        check_delay: Number(checkDelay) || 0.3,
        submission_type: submissionType,
        max_retries: Number(maxRetries) || 3,
      })
      setPages(result?.pages || [])
      await loadJobs()
      if (result?.job_id) setSelectedJobId(result.job_id)
    } catch (issue: any) {
      setError(readErrorMessage(issue, copy.runFailed))
    } finally {
      setRunning(false)
    }
  }

  const exportResultsCsv = () => {
    const headers = copy.table
    const lines = filteredPages.map((item) => {
      const indexed = item.indexed === null || item.indexed === undefined ? copy.unknown : item.indexed ? copy.yes : copy.no
      const status = item.coverage || item.indexing_state || item.status_message || ''
      const checked = item.last_crawl || item.checked_at || ''
      return [toCsvCell(item.url || ''), toCsvCell(indexed), toCsvCell(status), toCsvCell(checked), toCsvCell(item.error || '')].join(',')
    })
    downloadText(`indexing-pages-${selectedJobId || 'latest'}.csv`, [headers.map(toCsvCell).join(','), ...lines].join('\n'), 'text/csv;charset=utf-8;')
  }

  const exportPreparedSubmitReady = () => {
    if (!prepareResult?.submit_ready_urls?.length) return
    downloadText('submit-ready-urls.txt', prepareResult.submit_ready_urls.join('\n'))
  }

  const exportPreparedExcluded = () => {
    if (!prepareResult?.excluded_urls?.length) return
    const headers = ['url', 'reason', 'reason_label', 'source_file', 'issue']
    const rows = prepareResult.excluded_urls.map((item) =>
      [item.url, item.reason, item.reason_label, item.source_file, item.issue].map(toCsvCell).join(','),
    )
    downloadText('excluded-urls.csv', [headers.map(toCsvCell).join(','), ...rows].join('\n'), 'text/csv;charset=utf-8;')
  }

  return (
    <div id="page-indexing" className="page page-active">
      <div className="page-header linear-page-header">
        <div>
          <div className="page-title">{copy.title}</div>
          <div className="page-desc">{copy.desc}</div>
        </div>
        <div className="linear-header-meta">
          <span>{pages.length} {copy.pages}</span>
          <span>{action === 'submit' ? copy.actionSubmit : copy.actionInspect}</span>
        </div>
      </div>

      <div className="page-body linear-workbench rank-linear-workbench indexing-linear-workbench">
        <section className="linear-left rank-left-panel indexing-left-panel">
          <div className="settings-status-strip" style={{ position: 'static', paddingTop: 0 }}>
            <span className={hasGoogleCreds ? 'status-chip ready' : 'status-chip warn'}>
              {copy.credentials}: {hasGoogleCreds ? copy.ready : copy.missing}
            </span>
            <span className={indexingEnabled ? 'status-chip ready' : 'status-chip warn'}>
              {copy.indexing}: {indexingEnabled ? copy.enabled : copy.disabled}
            </span>
            <span className="status-chip muted">{copy.pendingUrls}{urls.length}</span>
            <span className="status-chip muted">{copy.lastRun}{lastRunAt ? new Date(lastRunAt).toLocaleString() : '-'}</span>
          </div>

          {!isReady ? (
            <Alert tone="warn">
              <div>{jobsMessage || copy.setupRequired}</div>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('/settings')}>
                {copy.openSettings}
              </button>
            </Alert>
          ) : null}

          <div className="rank-section">
            <div className="linear-panel-title">{copy.intakeTitle}</div>
            <p className="muted-text indexing-section-note">{copy.intakeDesc}</p>
            <div className="linear-inspector-grid">
              <div className="field-block">
                <label>{copy.uploadFiles}</label>
                <input type="file" accept=".csv" multiple onChange={handlePrepareUpload} />
                <div className="field-hint">{copy.uploadHint}</div>
              </div>
              {prepareSources.length ? (
                <div className="indexing-file-list">
                  {prepareSources.map((item) => <span key={item.filename} className="status-chip muted">{item.filename}</span>)}
                </div>
              ) : null}
              <div className="rank-action-row">
                <button className="btn btn-primary btn-sm" onClick={prepareFromFiles} disabled={!prepareSources.length || preparing}>
                  {preparing ? copy.preparing : copy.prepare}
                </button>
                <button className="btn btn-sm" onClick={usePreparedUrls} disabled={!prepareResult?.submit_ready_urls?.length}>
                  {copy.useSubmitReady}
                </button>
                <button className="btn btn-sm" onClick={() => { setPrepareResult(null); setPrepareSources([]) }} disabled={!prepareResult && !prepareSources.length}>
                  {copy.clearPrepared}
                </button>
              </div>
            </div>
          </div>

          <div className="rank-section">
            <div className="linear-panel-title">{copy.workspaceTitle}</div>
            <p className="muted-text indexing-section-note">{copy.workspaceDesc}</p>
            <div className="linear-inspector-grid">
              <div className="field-block">
                <label>{copy.siteUrl}</label>
                <input value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="https://www.example.com" />
              </div>
              <div className="field-block">
                <label>{copy.uploadFile}</label>
                <input type="file" accept=".txt,.csv,.xml,.html,.md" onChange={handleImportFile} />
              </div>
              <div className="field-block">
                <label>{copy.manualUrls}</label>
                <textarea rows={10} value={urlsText} onChange={(event) => setUrlsText(event.target.value)} placeholder={'https://example.com/a\nhttps://example.com/b'} />
                <div className="field-hint">{copy.manualHint}</div>
              </div>
              <div className="rank-action-row">
                <button className="btn btn-sm" onClick={handleAiFallback} disabled={!uploadedText || aiProcessing}>
                  {aiProcessing ? copy.aiProcessing : copy.aiFallback}
                </button>
                <button className="btn btn-sm" onClick={() => setUrlsText('')}>
                  {copy.clearUrls}
                </button>
                {parseSource !== 'none' ? (
                  <span className="muted-text">{copy.parseSource}{parseSource === 'local' ? copy.localParser : copy.aiFallbackSource}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rank-section">
            <button className="btn btn-sm" onClick={() => setShowAdvanced((current) => !current)}>
              {showAdvanced ? copy.advancedHide : copy.advancedShow}
            </button>
            {showAdvanced ? (
              <div className="linear-inspector-grid rank-form-grid" style={{ marginTop: 10 }}>
                <div className="field-block">
                  <label>{copy.action}</label>
                  <select value={action} onChange={(event) => setAction(event.target.value as 'inspect' | 'submit')}>
                    <option value="submit">{copy.actionSubmit}</option>
                    <option value="inspect">{copy.actionInspect}</option>
                  </select>
                </div>
                <div className="field-block">
                  <label>{copy.maxPages}</label>
                  <input value={maxPages} onChange={(event) => setMaxPages(event.target.value)} />
                </div>
                <div className="field-block">
                  <label>{copy.crawlDelay}</label>
                  <input value={crawlDelay} onChange={(event) => setCrawlDelay(event.target.value)} />
                </div>
                <div className="field-block">
                  <label>{copy.checkDelay}</label>
                  <input value={checkDelay} onChange={(event) => setCheckDelay(event.target.value)} />
                </div>
                <div className="field-block">
                  <label>{copy.submissionType}</label>
                  <select value={submissionType} onChange={(event) => setSubmissionType(event.target.value as 'URL_UPDATED' | 'URL_DELETED')}>
                    <option value="URL_UPDATED">URL_UPDATED</option>
                    <option value="URL_DELETED">URL_DELETED</option>
                  </select>
                </div>
                <div className="field-block">
                  <label>{copy.maxRetries}</label>
                  <input value={maxRetries} onChange={(event) => setMaxRetries(event.target.value)} />
                </div>
                <div className="field-block">
                  <label>{copy.serverFilePath}</label>
                  <input value={urlFilePath} onChange={(event) => setUrlFilePath(event.target.value)} placeholder="D:\\data\\urls.txt" />
                </div>
              </div>
            ) : null}
          </div>

          <button className="btn btn-primary btn-full" onClick={run} disabled={!canRun}>
            {running ? runningLabel : startButtonLabel}
          </button>
          {error ? <Alert tone="error">{error}</Alert> : null}
          {jobsStatus === 'configuration_required' && jobsMessage ? <Alert tone="warn">{jobsMessage}</Alert> : null}
        </section>

        <section className="linear-main rank-main-panel indexing-main-panel">
          <div className="rank-section indexing-summary-card">
            <div className="linear-panel-title">{copy.intakeTitle}</div>
            {!prepareResult ? (
              <EmptyState title={copy.intakeTitle} description={copy.noPrepared} />
            ) : (
              <div className="indexing-prepare-stack">
                <div className="indexing-metrics-grid">
                  <div className="indexing-metric"><strong>{prepareResult.counts.raw}</strong><span>{copy.rawUrls}</span></div>
                  <div className="indexing-metric"><strong>{prepareResult.counts.submit_ready}</strong><span>{copy.submitReady}</span></div>
                  <div className="indexing-metric"><strong>{prepareResult.counts.excluded}</strong><span>{copy.excluded}</span></div>
                  <div className="indexing-metric"><strong>{prepareResult.source_files.length}</strong><span>{copy.sourceFiles}</span></div>
                </div>

                <div className="indexing-summary-grid">
                  <div className="indexing-summary-panel">
                    <div className="wizard-title">{copy.issueBreakdown}</div>
                    {Object.keys(prepareResult.submit_counts_by_issue).length ? (
                      Object.entries(prepareResult.submit_counts_by_issue).map(([label, count]) => (
                        <div key={label} className="list-row indexing-summary-row"><span>{label}</span><strong>{count}</strong></div>
                      ))
                    ) : <span className="muted-text">-</span>}
                  </div>
                  <div className="indexing-summary-panel">
                    <div className="wizard-title">{copy.excludedBreakdown}</div>
                    {Object.keys(prepareResult.excluded_counts_by_reason).length ? (
                      Object.entries(prepareResult.excluded_counts_by_reason).map(([label, count]) => (
                        <div key={label} className="list-row indexing-summary-row"><span>{label}</span><strong>{count}</strong></div>
                      ))
                    ) : <span className="muted-text">-</span>}
                  </div>
                </div>

                <div className="indexing-preview-grid">
                  <div className="indexing-preview-card">
                    <div className="indexing-preview-head">
                      <div>
                        <div className="wizard-title">{copy.submitReady}</div>
                        <div className="muted-text">{prepareResult.submit_ready_urls.length} URLs</div>
                      </div>
                      <button className="btn btn-sm" onClick={exportPreparedSubmitReady}>{copy.exportSubmitReady}</button>
                    </div>
                    <div className="indexing-preview-list">
                      {prepareResult.submit_ready_urls.slice(0, 12).map((item) => <div key={item} className="indexing-preview-item" title={item}>{item}</div>)}
                    </div>
                  </div>

                  <div className="indexing-preview-card">
                    <div className="indexing-preview-head">
                      <div>
                        <div className="wizard-title">{copy.excluded}</div>
                        <div className="muted-text">{prepareResult.excluded_urls.length} URLs</div>
                      </div>
                      <button className="btn btn-sm" onClick={exportPreparedExcluded}>{copy.exportExcluded}</button>
                    </div>
                    <div className="indexing-preview-list">
                      {prepareResult.excluded_urls.slice(0, 12).map((item) => (
                        <div key={`${item.url}-${item.reason}`} className="indexing-preview-item">
                          <strong>{item.reason_label}</strong>
                          <span title={item.url}>{item.url}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rank-section indexing-results-card">
            <div className="indexing-results-head">
              <div>
                <div className="linear-panel-title">{copy.resultsTitle}</div>
                <div className="muted-text">{copy.resultsDesc}</div>
              </div>
              <button className="btn btn-sm" onClick={exportResultsCsv} disabled={!filteredPages.length}>{copy.exportCsv}</button>
            </div>

            <div className="linear-table-tools">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'indexed' | 'not_indexed' | 'error')}>
                <option value="all">{copy.all}</option>
                <option value="indexed">{copy.indexed}</option>
                <option value="not_indexed">{copy.notIndexed}</option>
                <option value="error">{copy.error}</option>
              </select>
            </div>

            <div className="linear-table-wrap">
              <table className="tbl linear-table table-comfort">
                <thead>
                  <tr>
                    {copy.table.map((header) => <th key={header}>{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {!pagedPages.length ? (
                    <tr><td colSpan={5}><EmptyState title={copy.resultsTitle} description={copy.empty} /></td></tr>
                  ) : pagedPages.map((item, index) => (
                    <tr key={`${item.url}-${index}`}>
                      <td title={item.url}>{item.url}</td>
                      <td>{item.indexed === null || item.indexed === undefined ? copy.unknown : item.indexed ? copy.yes : copy.no}</td>
                      <td>{item.coverage || item.indexing_state || item.status_message || '-'}</td>
                      <td>{item.last_crawl || (item.checked_at ? new Date(item.checked_at).toLocaleString() : '-')}</td>
                      <td>{item.error || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="linear-table-footer">
              <span>{filteredPages.length} {copy.rows}</span>
              <div className="linear-pager">
                <select value={pageSize} onChange={(event) => setPageSize(event.target.value)}>
                  <option value="10">10 {copy.pageSize}</option>
                  <option value="20">20 {copy.pageSize}</option>
                  <option value="50">50 {copy.pageSize}</option>
                </select>
                <button className="btn btn-xs" onClick={() => setPageIndex((p) => Math.max(1, p - 1))} disabled={pageIndex <= 1}>{copy.prev}</button>
                <span>{pageIndex} / {totalPages}</span>
                <button className="btn btn-xs" onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))} disabled={pageIndex >= totalPages}>{copy.next}</button>
              </div>
            </div>
          </div>
        </section>

        <section className="linear-right indexing-right-panel">
          <div className="rank-stepper indexing-side-panel">
            <div className="wizard-title">{copy.workspaceTitle}</div>
            <div className="ai-home-principles">
              <div className="ai-home-principle">
                <strong>{language === 'zh' ? '先预处理，再提交' : 'Prepare first, submit second'}</strong>
                <span>{language === 'zh' ? '先把 Search Console 导出的 CSV 清洗成 submit-ready URL，再进入提交步骤。' : 'Clean the Search Console exports into submit-ready URLs before moving into the submission step.'}</span>
              </div>
              <div className="ai-home-principle">
                <strong>{language === 'zh' ? '把它当成可选模块' : 'Treat this as optional'}</strong>
                <span>{language === 'zh' ? '没有 Google 凭证时，这个模块应优雅降级，不影响关键词和文章工作流。' : 'Without Google credentials, this module should degrade gracefully and never block keyword or article workflows.'}</span>
              </div>
            </div>
          </div>
          <div className="linear-panel-title">{copy.history}</div>
          <div className="muted-text indexing-section-note">{copy.historyDesc}</div>

          {prepareResult ? (
            <div className="rank-stepper indexing-side-panel">
              <div className="wizard-title">{copy.generatedFiles}</div>
              {Object.entries(prepareResult.generated_files).map(([key, value]) => (
                <div key={key} className="list-row indexing-side-row">
                  <span>{key}</span>
                  <span className="muted-text" title={value}>{value.split(/[\\/]/).pop()}</span>
                </div>
              ))}
            </div>
          ) : null}

          {prepareResult?.ignored_files?.length ? (
            <div className="rank-stepper indexing-side-panel">
              <div className="wizard-title">{copy.ignoredFiles}</div>
              {prepareResult.ignored_files.map((item) => <div key={item} className="muted-text indexing-side-row">{item}</div>)}
            </div>
          ) : null}

          <div className="geo-history-list">
            {!jobs.length ? <span className="muted-text">{copy.noJobs}</span> : jobs.map((job) => (
              <button key={job.id} className={`draft-item geo-history-item ${selectedJobId === job.id ? 'active' : ''}`} onClick={() => setSelectedJobId(job.id)}>
                <strong className="geo-history-title">{job.action === 'submit' ? copy.actionSubmit : copy.actionInspect}</strong>
                <span className="muted-text">{job.site_url || '-'} / {(job.summary?.total ?? 0)}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
