import { useDeferredValue, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, EmptyState } from '@/components/ui/States'
import { useI18n } from '@/i18n/useI18n'
import { consumeWorkbenchTaskDraft } from '@/lib/workbenchDrafts'
import { indexingApi, settingsApi } from '@/services/api'
import type { IndexingPrepareBatch, IndexingPrepareResult, SettingsItem } from '@/types'

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

type IndexingJobSummary = {
  total?: number
  success?: number
  failed?: number
}

type IndexingJobItem = {
  id: string
  action: 'inspect' | 'submit' | string
  site_url: string
  status: string
  summary: IndexingJobSummary
  started_at: string
  finished_at: string
  created_at: string
}

function toCsvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function uniqueUrls(values: string[]) {
  const seen = new Set<string>()
  return values
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false
      seen.add(item)
      return true
    })
}

function parseUrlsLocally(text: string) {
  if (!text.trim()) return []
  const urls: string[] = []
  const locMatches = text.match(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi) || []
  locMatches.forEach((item) => urls.push(item.replace(/<\/?loc>/gi, '').trim()))
  const regexMatches = text.match(/https?:\/\/[^\s"'<>]+/gi) || []
  regexMatches.forEach((item) => urls.push(item.trim().replace(/[;,]$/, '')))
  return uniqueUrls(urls)
}

function inferSiteUrlFromInput(siteUrl: string, urls: string[]) {
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
  const detail = issue?.response?.data?.detail || issue?.response?.data?.error
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

function formatDate(value?: string) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export function IndexingPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const copy = t.indexing

  const [settings, setSettings] = useState<SettingsItem | null>(null)
  const [jobs, setJobs] = useState<IndexingJobItem[]>([])
  const [jobsStatus, setJobsStatus] = useState('')
  const [jobsMessage, setJobsMessage] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [pages, setPages] = useState<IndexingRow[]>([])

  const [prepareSources, setPrepareSources] = useState<UploadedSource[]>([])
  const [prepareResult, setPrepareResult] = useState<IndexingPrepareResult | null>(null)
  const [prepareBatches, setPrepareBatches] = useState<IndexingPrepareBatch[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [preparing, setPreparing] = useState(false)

  const [siteUrl, setSiteUrl] = useState('')
  const [urlsText, setUrlsText] = useState('')
  const [submitFiles, setSubmitFiles] = useState<string[]>([])
  const [activeSourceBatchId, setActiveSourceBatchId] = useState('')
  const [activeSourceFiles, setActiveSourceFiles] = useState<string[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [action, setAction] = useState<'inspect' | 'submit'>('submit')
  const [maxPages, setMaxPages] = useState('50')
  const [crawlDelay, setCrawlDelay] = useState('0.5')
  const [checkDelay, setCheckDelay] = useState('0.3')
  const [submissionType, setSubmissionType] = useState<'URL_UPDATED' | 'URL_DELETED'>('URL_UPDATED')
  const [maxRetries, setMaxRetries] = useState('3')

  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'indexed' | 'not_indexed' | 'error'>('all')
  const [pageSize, setPageSize] = useState('20')
  const [pageIndex, setPageIndex] = useState(1)

  const deferredQuery = useDeferredValue(query)
  const hasGoogleCreds = Boolean(settings?.google_credentials_path_configured || settings?.google_credentials_path)
  const indexingEnabled = Boolean(settings?.indexing_enabled)
  const isReady = hasGoogleCreds && indexingEnabled
  const urls = useMemo(() => uniqueUrls(urlsText.split('\n')), [urlsText])
  const inputSiteUrl = inferSiteUrlFromInput(siteUrl, urls)
  const canRun = isReady && Boolean(inputSiteUrl || urls.length) && !running
  const lastRunAt = jobs[0]?.finished_at || jobs[0]?.created_at || ''

  const selectedJob = useMemo(() => jobs.find((item) => item.id === selectedJobId) || jobs[0] || null, [jobs, selectedJobId])
  const summaryTotal = Number(selectedJob?.summary?.total || 0)
  const summarySuccess = Number(selectedJob?.summary?.success || 0)
  const summaryFailed = Number(selectedJob?.summary?.failed || 0)
  const summaryCompleted = Math.min(summaryTotal, summarySuccess + summaryFailed)
  const summaryPending = Math.max(0, summaryTotal - summaryCompleted)
  const completionPercent = summaryTotal ? Math.round((summaryCompleted / summaryTotal) * 100) : 0
  const successPercent = summaryTotal ? (summarySuccess / summaryTotal) * 100 : 0
  const failedPercent = summaryTotal ? (summaryFailed / summaryTotal) * 100 : 0

  const filteredPages = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
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
      return [item.url, item.coverage, item.indexing_state, item.status_message, item.error].join(' ').toLowerCase().includes(q)
    })
  }, [pages, deferredQuery, statusFilter])

  const totalPages = useMemo(() => {
    const size = Math.max(1, Number(pageSize) || 20)
    return Math.max(1, Math.ceil(filteredPages.length / size))
  }, [filteredPages.length, pageSize])

  const pagedPages = useMemo(() => {
    const size = Math.max(1, Number(pageSize) || 20)
    const safePage = Math.min(pageIndex, totalPages)
    return filteredPages.slice((safePage - 1) * size, safePage * size)
  }, [filteredPages, pageIndex, pageSize, totalPages])

  const loadPrepareBatches = async () => {
    const items = await indexingApi.prepareBatches()
    setPrepareBatches(items)
    setSelectedBatchId((current) => current || items[0]?.id || '')
  }

  const loadJobs = async (keepSelection = true) => {
    const data = await indexingApi.jobs()
    const items = (data?.items || []) as IndexingJobItem[]
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
        await Promise.all([loadJobs(false), loadPrepareBatches()])
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
      const draftUrls = Array.isArray(draft.prefill.urls)
        ? draft.prefill.urls.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
        : []
      if (draftUrls.length) {
        setUrlsText(draftUrls.join('\n'))
        setSiteUrl(inferSiteUrlFromInput('', draftUrls))
      }
      if (draft.prefill.action === 'inspect' || draft.prefill.action === 'submit') setAction(draft.prefill.action)
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
  }, [deferredQuery, statusFilter, pageSize, pages])

  const handlePrepareUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    const nextSources = await Promise.all(files.map(async (file) => ({ filename: file.name, content: await file.text() })))
    setPrepareSources((current) => [...current, ...nextSources])
    setPrepareResult(null)
    setError('')
    event.target.value = ''
  }

  const removePrepareSource = (filename: string) => {
    setPrepareSources((current) => current.filter((item) => item.filename !== filename))
  }

  const prepareFromFiles = async () => {
    if (!prepareSources.length) {
      setError(copy.uploadFirst)
      return
    }
    setPreparing(true)
    setError('')
    setNotice('')
    try {
      const result = await indexingApi.prepare({ sources: prepareSources })
      setPrepareResult(result)
      setSelectedBatchId(result.batch_id || result.id || '')
      await loadPrepareBatches()
      setNotice('预处理结果已保存，可以回填到提交清单。')
    } catch (issue: any) {
      setError(readErrorMessage(issue, copy.prepareFailed))
    } finally {
      setPreparing(false)
    }
  }

  const usePreparedBatch = async (batch?: IndexingPrepareResult | null) => {
    let target = batch
    if (!target && selectedBatchId) {
      target = await indexingApi.prepareBatch(selectedBatchId)
      setPrepareResult(target)
    }
    if (!target?.submit_ready_urls?.length) return
    setUrlsText(target.submit_ready_urls.join('\n'))
    setAction('submit')
    setActiveSourceBatchId(target.batch_id || target.id || selectedBatchId)
    setActiveSourceFiles(target.source_files || [])
    setNotice(`已回填 ${target.submit_ready_urls.length} 个可提交 URL。`)
  }

  const handleSubmitFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    const parsed: string[] = []
    for (const file of files) {
      parsed.push(...parseUrlsLocally(await file.text()))
    }
    const merged = uniqueUrls([...urls, ...parsed])
    setUrlsText(merged.join('\n'))
    setSubmitFiles((current) => [...current, ...files.map((file) => file.name)])
    setActiveSourceBatchId('')
    setActiveSourceFiles((current) => [...current, ...files.map((file) => file.name)])
    setNotice(`已从 ${files.length} 个文件解析并合并 URL。`)
    event.target.value = ''
  }

  const run = async () => {
    if (!canRun) return
    setRunning(true)
    setError('')
    setNotice('')
    try {
      const result = await indexingApi.run({
        action,
        site_url: inputSiteUrl,
        urls,
        max_pages: Number(maxPages) || 50,
        crawl_delay: Number(crawlDelay) || 0.5,
        check_delay: Number(checkDelay) || 0.3,
        submission_type: submissionType,
        max_retries: Number(maxRetries) || 3,
        source_batch_id: activeSourceBatchId,
        source_filenames: activeSourceFiles,
      })
      setPages(result?.pages || [])
      await loadJobs()
      if (result?.job_id) setSelectedJobId(result.job_id)
      setNotice(action === 'submit' ? '提交任务已完成。' : '检查任务已完成。')
    } catch (issue: any) {
      setError(readErrorMessage(issue, copy.runFailed))
    } finally {
      setRunning(false)
    }
  }

  const handleRunSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await run()
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
          <span>{urls.length} {copy.pages}</span>
          <span>{action === 'submit' ? copy.actionSubmit : copy.actionInspect}</span>
        </div>
      </div>

      <div className="page-body indexing-workbench-v2">
        <div className="settings-status-strip indexing-status-strip">
          <span className={hasGoogleCreds ? 'status-chip ready' : 'status-chip warn'}>{copy.credentials}: {hasGoogleCreds ? copy.ready : copy.missing}</span>
          <span className={indexingEnabled ? 'status-chip ready' : 'status-chip warn'}>{copy.indexing}: {indexingEnabled ? copy.enabled : copy.disabled}</span>
          <span className="status-chip muted">{copy.pendingUrls}{urls.length}</span>
          <span className="status-chip muted">{copy.lastRun}{lastRunAt ? formatDate(lastRunAt) : '-'}</span>
        </div>

        {!isReady ? (
          <Alert tone="warn">
            <div>{copy.setupRequired}</div>
            <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('/settings')}>{copy.openSettings}</button>
          </Alert>
        ) : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {isReady && jobsStatus === 'configuration_required' && jobsMessage ? <Alert tone="warn">{jobsMessage}</Alert> : null}

        <div className="indexing-top-grid indexing-top-grid-three">
          <section className="indexing-stage">
            <div className="indexing-stage-head">
              <div>
                <span className="indexing-step-badge">1</span>
                <div className="linear-panel-title">{copy.intakeTitle}</div>
                <p className="muted-text indexing-section-note">{copy.intakeDesc}</p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={prepareFromFiles} disabled={!prepareSources.length || preparing}>
                {preparing ? copy.preparing : copy.prepare}
              </button>
            </div>

            <div className="indexing-column-stack">
              <div className="indexing-drop-panel">
                <label className="field-block">
                  <span>{copy.uploadFiles}</span>
                  <input type="file" accept=".csv" multiple onChange={handlePrepareUpload} />
                </label>
                <div className="field-hint">{copy.uploadHint}</div>
                <div className="indexing-file-list-v2">
                  {!prepareSources.length ? <span className="muted-text">尚未选择文件</span> : prepareSources.map((item) => (
                    <button key={item.filename} className="indexing-file-pill" onClick={() => removePrepareSource(item.filename)} title="点击移除">
                      {item.filename}
                    </button>
                  ))}
                </div>
              </div>

              <div className="indexing-history-panel">
                <div className="indexing-card-title">预处理历史</div>
                {!prepareBatches.length ? <span className="muted-text">暂无预处理历史</span> : (
                  <div className="indexing-batch-list">
                    {prepareBatches.slice(0, 6).map((batch) => (
                      <button
                        key={batch.id}
                        className={`indexing-batch-item ${selectedBatchId === batch.id ? 'active' : ''}`}
                        onClick={async () => {
                          setSelectedBatchId(batch.id)
                          const detail = await indexingApi.prepareBatch(batch.id)
                          setPrepareResult(detail)
                        }}
                      >
                        <strong>{batch.counts.submit_ready} 可提交 / {batch.counts.excluded} 已排除</strong>
                        <span>{formatDate(batch.created_at)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {prepareResult ? (
                <div className="indexing-drop-panel">
                  <div className="indexing-metrics-grid">
                    <div className="indexing-metric"><strong>{prepareResult.counts.raw}</strong><span>{copy.rawUrls}</span></div>
                    <div className="indexing-metric"><strong>{prepareResult.counts.submit_ready}</strong><span>{copy.submitReady}</span></div>
                    <div className="indexing-metric"><strong>{prepareResult.counts.excluded}</strong><span>{copy.excluded}</span></div>
                    <div className="indexing-metric"><strong>{prepareResult.source_files.length}</strong><span>{copy.sourceFiles}</span></div>
                  </div>
                  <div className="rank-action-row">
                    <button className="btn btn-primary btn-sm" onClick={() => void usePreparedBatch(prepareResult)} disabled={!prepareResult.submit_ready_urls.length}>{copy.useSubmitReady}</button>
                    <button className="btn btn-sm" onClick={exportPreparedSubmitReady} disabled={!prepareResult.submit_ready_urls.length}>{copy.exportSubmitReady}</button>
                    <button className="btn btn-sm" onClick={exportPreparedExcluded} disabled={!prepareResult.excluded_urls.length}>{copy.exportExcluded}</button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="indexing-stage indexing-stage-main">
            <div className="indexing-stage-head">
              <div>
                <span className="indexing-step-badge">2</span>
                <div className="linear-panel-title">{copy.workspaceTitle}</div>
                <p className="muted-text indexing-section-note">{copy.workspaceDesc}</p>
              </div>
              <button className="btn btn-sm" onClick={() => setShowAdvanced((current) => !current)}>
                {showAdvanced ? copy.advancedHide : copy.advancedShow}
              </button>
            </div>

            <form className="indexing-column-stack" onSubmit={(event) => void handleRunSubmit(event)}>
              <div className="indexing-run-grid">
                <div className="field-block">
                  <label>{copy.siteUrl}</label>
                  <input value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="https://www.example.com" />
                </div>
                <div className="field-block">
                  <label>{copy.action}</label>
                  <select value={action} onChange={(event) => setAction(event.target.value as 'inspect' | 'submit')}>
                    <option value="submit">{copy.actionSubmit}</option>
                    <option value="inspect">{copy.actionInspect}</option>
                  </select>
                </div>
                <div className="field-block indexing-submit-upload">
                  <label>{copy.uploadFile}</label>
                  <input type="file" accept=".txt,.csv,.xml,.html,.md" multiple onChange={handleSubmitFiles} />
                  <div className="field-hint">{submitFiles.length ? `已合并 ${submitFiles.length} 个文件` : '支持多文件合并与去重。'}</div>
                </div>
              </div>

              <div className="field-block">
                <label>{copy.manualUrls}</label>
                <textarea
                  rows={10}
                  value={urlsText}
                  onChange={(event) => {
                    setUrlsText(event.target.value)
                    setActiveSourceBatchId('')
                  }}
                  placeholder={'https://example.com/a\nhttps://example.com/b'}
                />
                <div className="field-hint">
                  {copy.manualHint} 当前 {urls.length} 条 URL。{activeSourceBatchId ? `来源批次：${activeSourceBatchId}` : ''}
                </div>
              </div>

              {showAdvanced ? (
                <div className="linear-inspector-grid rank-form-grid">
                  <div className="field-block"><label>{copy.maxPages}</label><input value={maxPages} onChange={(event) => setMaxPages(event.target.value)} /></div>
                  <div className="field-block"><label>{copy.crawlDelay}</label><input value={crawlDelay} onChange={(event) => setCrawlDelay(event.target.value)} /></div>
                  <div className="field-block"><label>{copy.checkDelay}</label><input value={checkDelay} onChange={(event) => setCheckDelay(event.target.value)} /></div>
                  <div className="field-block"><label>{copy.submissionType}</label><select value={submissionType} onChange={(event) => setSubmissionType(event.target.value as 'URL_UPDATED' | 'URL_DELETED')}><option value="URL_UPDATED">URL_UPDATED</option><option value="URL_DELETED">URL_DELETED</option></select></div>
                  <div className="field-block"><label>{copy.maxRetries}</label><input value={maxRetries} onChange={(event) => setMaxRetries(event.target.value)} /></div>
                </div>
              ) : null}

              <div className="rank-action-row">
                <button type="submit" className="btn btn-primary btn-sm" disabled={!canRun}>
                  {running ? (action === 'submit' ? copy.runningSubmit : copy.runningInspect) : (action === 'submit' ? copy.startSubmit : copy.startInspect)}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setUrlsText('')
                    setSubmitFiles([])
                    setActiveSourceBatchId('')
                    setActiveSourceFiles([])
                  }}
                >
                  {copy.clearUrls}
                </button>
              </div>
            </form>
          </section>

          <section className="indexing-stage">
            <div className="indexing-stage-head">
              <div>
                <span className="indexing-step-badge">3</span>
                <div className="linear-panel-title">{copy.progressTitle}</div>
                <p className="muted-text indexing-section-note">{running ? copy.progressRunning : copy.progressDesc}</p>
              </div>
              <div className="linear-header-meta">
                <span>{running ? '...' : `${completionPercent}%`}</span>
              </div>
            </div>

            <div className="indexing-column-stack">
              <div className="indexing-progress-panel">
                <div className="indexing-progress-track">
                  <div className="indexing-progress-segment success" style={{ width: `${successPercent}%` }} />
                  <div className="indexing-progress-segment failed" style={{ width: `${failedPercent}%` }} />
                  {running ? <div className="indexing-progress-indeterminate" /> : null}
                </div>
                <div className="indexing-progress-stats compact">
                  <div className="indexing-progress-stat">
                    <strong>{summaryTotal || urls.length}</strong>
                    <span>{copy.submitReady}</span>
                  </div>
                  <div className="indexing-progress-stat success">
                    <strong>{summarySuccess}</strong>
                    <span>{copy.progressSuccess}</span>
                  </div>
                  <div className="indexing-progress-stat failed">
                    <strong>{summaryFailed}</strong>
                    <span>{copy.progressFailed}</span>
                  </div>
                  <div className="indexing-progress-stat muted">
                    <strong>{running ? copy.progressInFlight : summaryPending}</strong>
                    <span>{copy.progressPending}</span>
                  </div>
                </div>
              </div>

              <div className="indexing-jobs-panel">
                <div className="indexing-card-title">{copy.history}</div>
                {!jobs.length ? <span className="muted-text">{copy.noJobs}</span> : (
                  <div className="indexing-batch-list">
                    {jobs.map((job) => (
                      <button key={job.id} className={`indexing-batch-item ${selectedJobId === job.id ? 'active' : ''}`} onClick={() => setSelectedJobId(job.id)}>
                        <strong>{job.action === 'submit' ? copy.actionSubmit : copy.actionInspect}</strong>
                        <span>{job.site_url || '-'} / {(job.summary?.total ?? 0)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="indexing-stage">
          <div className="indexing-stage-head">
            <div>
              <div className="linear-panel-title">{copy.resultsTitle}</div>
              <p className="muted-text indexing-section-note">{copy.resultsDesc}</p>
            </div>
            <button className="btn btn-sm" onClick={exportResultsCsv} disabled={!filteredPages.length}>{copy.exportCsv}</button>
          </div>

          <div className="indexing-results-layout indexing-results-layout-wide">
            <div className="indexing-table-panel">
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
                  <thead><tr>{copy.table.map((header) => <th key={header}>{header}</th>)}</tr></thead>
                  <tbody>
                    {!pagedPages.length ? (
                      <tr><td colSpan={5}><EmptyState title={copy.resultsTitle} description={copy.empty} /></td></tr>
                    ) : pagedPages.map((item, index) => (
                      <tr key={`${item.url}-${index}`}>
                        <td title={item.url}>{item.url}</td>
                        <td>{item.indexed === null || item.indexed === undefined ? copy.unknown : item.indexed ? copy.yes : copy.no}</td>
                        <td>{item.coverage || item.indexing_state || item.status_message || '-'}</td>
                        <td>{item.last_crawl || formatDate(item.checked_at)}</td>
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
          </div>
        </section>
      </div>
    </div>
  )
}
