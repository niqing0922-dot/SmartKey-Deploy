import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiApi, indexingApi, settingsApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'
import type { SettingsItem } from '@/types'

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

export function IndexingPage() {
  const navigate = useNavigate()
  const { language } = useI18n()

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

  const [action, setAction] = useState<'inspect' | 'submit'>('inspect')
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
        if (!cancelled) {
          setError(issue?.response?.data?.detail || issue?.message || 'Failed to load settings')
        }
      }
      try {
        await loadJobs(false)
      } catch (issue: any) {
        if (!cancelled) {
          setError(issue?.response?.data?.detail || issue?.message || 'Failed to load indexing jobs')
        }
      }
    })()
    return () => {
      cancelled = true
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
      setError(language === 'zh' ? '本地解析未找到 URL，可尝试 AI 兜底解析。' : 'Local parser found no URLs. You can try AI fallback.')
    }
  }

  const handleAiFallback = async () => {
    if (!uploadedText.trim()) {
      setError(language === 'zh' ? '请先上传文件。' : 'Please upload a file first.')
      return
    }
    setAiProcessing(true)
    setError('')
    try {
      const result = await aiApi.indexingUrlExtract({ text: uploadedText, filename: uploadedFileName })
      const aiUrls = result?.urls || []
      if (!aiUrls.length) {
        setError(language === 'zh' ? 'AI 未识别到 URL。' : 'AI did not find any URLs.')
        return
      }
      setUrlsText(aiUrls.join('\n'))
      setParseSource('ai')
    } catch {
      setError(language === 'zh' ? 'AI 兜底解析失败。' : 'AI fallback parsing failed.')
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
      setError(issue?.response?.data?.detail || issue?.message || 'Failed to run indexing job')
    } finally {
      setRunning(false)
    }
  }

  const exportCsv = () => {
    const headers = ['URL', 'Indexed', 'Coverage / State', 'Last Crawl / Checked', 'Error']
    const lines = filteredPages.map((item) => {
      const indexed = item.indexed === null || item.indexed === undefined ? 'Unknown' : item.indexed ? 'Yes' : 'No'
      const status = item.coverage || item.indexing_state || item.status_message || ''
      const checked = item.last_crawl || item.checked_at || ''
      return [toCsvCell(item.url || ''), toCsvCell(indexed), toCsvCell(status), toCsvCell(checked), toCsvCell(item.error || '')].join(',')
    })
    const csv = [headers.map(toCsvCell).join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `indexing-pages-${selectedJobId || 'latest'}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div id="page-indexing" className="page page-active">
      <div className="page-header linear-page-header">
        <div>
          <div className="page-title">Google Indexing</div>
          <div className="page-desc">{language === 'zh' ? '输入网址或文件，一键检查是否被 Google 索引。' : 'Input URL or file and check Google indexing in one click.'}</div>
        </div>
        <div className="linear-header-meta"><span>{pages.length} pages</span></div>
      </div>

      <div className="page-body linear-workbench ai-linear-workbench">
        <section className="linear-left">
          <div className="settings-status-strip" style={{ position: 'static', paddingTop: 0 }}>
            <span className={hasGoogleCreds ? 'status-chip ready' : 'status-chip warn'}>
              Credentials: {hasGoogleCreds ? (language === 'zh' ? '可用' : 'Ready') : (language === 'zh' ? '缺失' : 'Missing')}
            </span>
            <span className={indexingEnabled ? 'status-chip ready' : 'status-chip warn'}>
              Indexing: {indexingEnabled ? (language === 'zh' ? '已启用' : 'Enabled') : (language === 'zh' ? '已停用' : 'Disabled')}
            </span>
            <span className="status-chip muted">{language === 'zh' ? '待检查 URL：' : 'Pending URLs: '}{urls.length}</span>
            <span className="status-chip muted">{language === 'zh' ? '最近任务：' : 'Last run: '}{lastRunAt ? new Date(lastRunAt).toLocaleString() : '-'}</span>
          </div>

          {!isReady ? (
            <div className="alert alert-warn">
              <div>{jobsMessage || (language === 'zh' ? '请先在设置页配置 Google Credentials 并启用 Indexing。' : 'Please configure Google Credentials and enable Indexing in Settings.')}</div>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('/settings')}>
                {language === 'zh' ? '打开设置' : 'Open Settings'}
              </button>
            </div>
          ) : null}

          <div className="rank-section">
            <div className="linear-panel-title">{language === 'zh' ? '主输入' : 'Primary Input'}</div>
            <div className="linear-inspector-grid">
              <div className="field-block">
                <label>{language === 'zh' ? '网址/站点网址' : 'URL / Site URL'}</label>
                <input value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="https://example.com/page" />
              </div>
              <div className="field-block">
                <label>{language === 'zh' ? '上传 URL 文件（txt/csv/xml/html/md）' : 'Upload URL file (txt/csv/xml/html/md)'}</label>
                <input type="file" accept=".txt,.csv,.xml,.html,.md" onChange={handleImportFile} />
              </div>
              <div className="field-block">
                <label>{language === 'zh' ? '解析后的 URL 列表' : 'Parsed URLs'}</label>
                <textarea rows={8} value={urlsText} onChange={(event) => setUrlsText(event.target.value)} placeholder={'https://example.com/a\nhttps://example.com/b'} />
              </div>
              <div className="rank-action-row">
                <button className="btn btn-sm" onClick={handleAiFallback} disabled={!uploadedText || aiProcessing}>
                  {aiProcessing ? (language === 'zh' ? 'AI 处理中...' : 'AI Processing...') : (language === 'zh' ? 'AI 兜底解析' : 'AI Fallback Parse')}
                </button>
                <button className="btn btn-sm" onClick={() => setUrlsText('')}>
                  {language === 'zh' ? '清空 URL 列表' : 'Clear URLs'}
                </button>
                {parseSource !== 'none' ? (
                  <span className="muted-text">{language === 'zh' ? '解析来源：' : 'Parse source: '}{parseSource === 'local' ? 'Local Parser' : 'AI Fallback'}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rank-section">
            <button className="btn btn-sm" onClick={() => setShowAdvanced((current) => !current)}>
              {showAdvanced ? (language === 'zh' ? '收起高级设置' : 'Hide Advanced Settings') : (language === 'zh' ? '高级设置' : 'Advanced Settings')}
            </button>
            {showAdvanced ? (
              <div className="linear-inspector-grid rank-form-grid" style={{ marginTop: 10 }}>
                <div className="field-block">
                  <label>Action</label>
                  <select value={action} onChange={(event) => setAction(event.target.value as 'inspect' | 'submit')}>
                    <option value="inspect">inspect</option>
                    <option value="submit">submit</option>
                  </select>
                </div>
                <div className="field-block">
                  <label>Max Pages</label>
                  <input value={maxPages} onChange={(event) => setMaxPages(event.target.value)} />
                </div>
                <div className="field-block">
                  <label>Crawl Delay</label>
                  <input value={crawlDelay} onChange={(event) => setCrawlDelay(event.target.value)} />
                </div>
                <div className="field-block">
                  <label>Check Delay</label>
                  <input value={checkDelay} onChange={(event) => setCheckDelay(event.target.value)} />
                </div>
                <div className="field-block">
                  <label>Submission Type</label>
                  <select value={submissionType} onChange={(event) => setSubmissionType(event.target.value as 'URL_UPDATED' | 'URL_DELETED')}>
                    <option value="URL_UPDATED">URL_UPDATED</option>
                    <option value="URL_DELETED">URL_DELETED</option>
                  </select>
                </div>
                <div className="field-block">
                  <label>Max Retries</label>
                  <input value={maxRetries} onChange={(event) => setMaxRetries(event.target.value)} />
                </div>
                <div className="field-block">
                  <label>{language === 'zh' ? 'URL 文件路径（服务端）' : 'URL file path (server-side)'}</label>
                  <input value={urlFilePath} onChange={(event) => setUrlFilePath(event.target.value)} placeholder="D:\\data\\urls.txt" />
                </div>
              </div>
            ) : null}
          </div>

          <button className="btn btn-primary btn-full" onClick={run} disabled={!canRun}>
            {running ? (language === 'zh' ? '检查中...' : 'Running...') : (language === 'zh' ? '开始检查索引' : 'Start Indexing Check')}
          </button>
          {error ? <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div> : null}
          {jobsStatus === 'configuration_required' && jobsMessage ? <div className="alert alert-warn" style={{ marginTop: 10 }}>{jobsMessage}</div> : null}
        </section>

        <section className="linear-main ai-main-panel">
          <div className="linear-table-tools">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={language === 'zh' ? '搜索 URL / 状态 / 错误' : 'Search URL / status / error'} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'indexed' | 'not_indexed' | 'error')}>
              <option value="all">All</option>
              <option value="indexed">Indexed</option>
              <option value="not_indexed">Not indexed</option>
              <option value="error">Error</option>
            </select>
            <button className="btn btn-sm" onClick={exportCsv} disabled={!filteredPages.length}>Export CSV</button>
          </div>
          <div className="linear-table-wrap">
            <table className="tbl linear-table table-comfort">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>{language === 'zh' ? '是否已索引' : 'Indexed'}</th>
                  <th>{language === 'zh' ? '覆盖/索引状态' : 'Coverage / State'}</th>
                  <th>{language === 'zh' ? '最近检查' : 'Last Checked'}</th>
                  <th>{language === 'zh' ? '错误' : 'Error'}</th>
                </tr>
              </thead>
              <tbody>
                {!pagedPages.length ? (
                  <tr><td colSpan={5}><div className="empty">{language === 'zh' ? '暂无索引结果' : 'No indexing pages yet'}</div></td></tr>
                ) : pagedPages.map((item, index) => (
                  <tr key={`${item.url}-${index}`}>
                    <td title={item.url}>{item.url}</td>
                    <td>{item.indexed === null || item.indexed === undefined ? (language === 'zh' ? '未知' : 'Unknown') : item.indexed ? (language === 'zh' ? '是' : 'Yes') : (language === 'zh' ? '否' : 'No')}</td>
                    <td>{item.coverage || item.indexing_state || item.status_message || '-'}</td>
                    <td>{item.last_crawl || (item.checked_at ? new Date(item.checked_at).toLocaleString() : '-')}</td>
                    <td>{item.error || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="linear-table-footer">
            <span>{filteredPages.length} rows</span>
            <div className="linear-pager">
              <select value={pageSize} onChange={(event) => setPageSize(event.target.value)}>
                <option value="10">10 / page</option>
                <option value="20">20 / page</option>
                <option value="50">50 / page</option>
              </select>
              <button className="btn btn-xs" onClick={() => setPageIndex((p) => Math.max(1, p - 1))} disabled={pageIndex <= 1}>Prev</button>
              <span>{pageIndex} / {totalPages}</span>
              <button className="btn btn-xs" onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))} disabled={pageIndex >= totalPages}>Next</button>
            </div>
          </div>
        </section>

        <section className="linear-right">
          <div className="linear-panel-title">{language === 'zh' ? '历史任务' : 'History'}</div>
          <div className="geo-history-list">
            {!jobs.length ? <span className="muted-text">{language === 'zh' ? '暂无任务' : 'No jobs yet'}</span> : jobs.map((job) => (
              <button key={job.id} className={`draft-item geo-history-item ${selectedJobId === job.id ? 'active' : ''}`} onClick={() => setSelectedJobId(job.id)}>
                <strong className="geo-history-title">{job.action}</strong>
                <span className="muted-text">{job.site_url || '-'} / {(job.summary?.total ?? 0)}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
