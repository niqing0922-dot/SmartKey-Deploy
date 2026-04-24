import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keywordsApi, rankApi, settingsApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'
import type { SettingsItem } from '@/types'

type RankResultRow = {
  keyword: string
  found: boolean
  page: number | null
  position: number | null
  url: string
  provider: string
  error: string
  queried_at: string
}

function toCsvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function normalizeKeywordLines(lines: string[]) {
  const seen = new Set<string>()
  const output: string[] = []
  lines.forEach((raw) => {
    const cleaned = raw.trim()
    if (!cleaned) return
    const key = cleaned.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    output.push(cleaned)
  })
  return output
}

export function RankPage() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const copy = t.rank

  const [settings, setSettings] = useState<SettingsItem | null>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [jobsStatus, setJobsStatus] = useState('')
  const [jobsMessage, setJobsMessage] = useState('')

  const [keywordsText, setKeywordsText] = useState('')
  const [libraryKeywords, setLibraryKeywords] = useState<string[]>([])
  const [librarySearch, setLibrarySearch] = useState('')
  const [showLibraryPanel, setShowLibraryPanel] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const [selectedJobId, setSelectedJobId] = useState('')
  const [results, setResults] = useState<RankResultRow[]>([])

  const [query, setQuery] = useState('')
  const [foundFilter, setFoundFilter] = useState<'all' | 'found' | 'not_found'>('all')
  const [pageSize, setPageSize] = useState('20')
  const [pageIndex, setPageIndex] = useState(1)

  const [maxPages, setMaxPages] = useState('5')
  const [region, setRegion] = useState('us')
  const [hl, setHl] = useState('en')
  const [resultsPerRequest, setResultsPerRequest] = useState('100')

  const hasSerpApi = Boolean(settings?.serpapi_key_configured || settings?.serpapi_key)
  const rankDomain = (settings?.rank_target_domain || '').trim()
  const rankReady = hasSerpApi && Boolean(rankDomain)

  const keywordList = useMemo(() => normalizeKeywordLines(keywordsText.split('\n')), [keywordsText])
  const keywordSet = useMemo(() => new Set(keywordList.map((item) => item.toLowerCase())), [keywordList])
  const canTrack = rankReady && keywordList.length > 0 && !running

  const filteredLibraryKeywords = useMemo(() => {
    const queryText = librarySearch.trim().toLowerCase()
    if (!queryText) return libraryKeywords
    return libraryKeywords.filter((item) => item.toLowerCase().includes(queryText))
  }, [libraryKeywords, librarySearch])

  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    return results.filter((item) => {
      const filterPass = foundFilter === 'all' ? true : foundFilter === 'found' ? item.found : !item.found
      if (!filterPass) return false
      if (!q) return true
      return [item.keyword, item.url, item.error, item.provider].join(' ').toLowerCase().includes(q)
    })
  }, [results, foundFilter, query])

  const totalPages = useMemo(() => {
    const size = Math.max(1, Number(pageSize) || 20)
    return Math.max(1, Math.ceil(filteredResults.length / size))
  }, [filteredResults.length, pageSize])

  const pagedResults = useMemo(() => {
    const size = Math.max(1, Number(pageSize) || 20)
    const safePage = Math.min(pageIndex, totalPages)
    const start = (safePage - 1) * size
    return filteredResults.slice(start, start + size)
  }, [filteredResults, pageIndex, pageSize, totalPages])

  const lastRunAt = jobs[0]?.finished_at || jobs[0]?.created_at || ''

  const loadJobs = async (keepSelected = true) => {
    const jobData = await rankApi.jobs()
    const items = jobData?.items || []
    setJobs(items)
    setJobsStatus(jobData?.status || '')
    setJobsMessage(jobData?.message || '')
    const nextId = keepSelected ? selectedJobId || items[0]?.id || '' : items[0]?.id || ''
    setSelectedJobId(nextId)
    if (nextId) {
      const resultData = await rankApi.results(nextId)
      setResults(resultData?.items || [])
    } else {
      setResults([])
    }
  }

  useEffect(() => {
    Promise.all([settingsApi.get(), loadJobs(false)])
      .then(([settingData]) => setSettings(settingData))
      .catch((issue: any) => setError(issue?.response?.data?.detail || issue?.message || 'Failed to load rank page'))
  }, [])

  useEffect(() => {
    keywordsApi
      .list()
      .then((items) => setLibraryKeywords(normalizeKeywordLines(items.map((item) => item.keyword))))
      .catch(() => setLibraryKeywords([]))
  }, [])

  useEffect(() => {
    if (!selectedJobId) return
    rankApi
      .results(selectedJobId)
      .then((data) => setResults(data?.items || []))
      .catch(() => setResults([]))
  }, [selectedJobId])

  useEffect(() => {
    setPageIndex(1)
  }, [query, foundFilter, pageSize, results])

  const loadKeywords = async () => {
    const items = await keywordsApi.list()
    const keywords = normalizeKeywordLines(items.map((item) => item.keyword))
    setLibraryKeywords(keywords)
    setKeywordsText(keywords.join('\n'))
  }

  const toggleKeyword = (keyword: string) => {
    setKeywordsText((current) => {
      const lines = normalizeKeywordLines(current.split('\n'))
      const key = keyword.trim()
      const exists = lines.some((item) => item.toLowerCase() === key.toLowerCase())
      if (exists) {
        return lines.filter((item) => item.toLowerCase() !== key.toLowerCase()).join('\n')
      }
      return [...lines, key].join('\n')
    })
  }

  const startTracking = async () => {
    if (!canTrack) return
    setRunning(true)
    setError('')
    try {
      const runData = await rankApi.run({
        keywords: keywordList,
        provider: 'serpapi',
        max_pages: Number(maxPages) || 5,
        results_per_request: Number(resultsPerRequest) || 100,
        hl: hl || 'en',
        gl: region,
        source: 'manual',
      })
      setResults(runData?.results || [])
      await loadJobs()
      if (runData?.job_id) setSelectedJobId(runData.job_id)
    } catch (issue: any) {
      setError(issue?.response?.data?.detail || issue?.message || 'Failed to run rank tracking')
    } finally {
      setRunning(false)
    }
  }

  const exportCsv = () => {
    const headers = ['Keyword', 'Found', 'Page', 'Position', 'URL', 'Provider', 'Error', 'Queried At']
    const lines = filteredResults.map((item) =>
      [
        toCsvCell(item.keyword),
        toCsvCell(item.found ? 'Yes' : 'No'),
        toCsvCell(item.page ?? ''),
        toCsvCell(item.position ?? ''),
        toCsvCell(item.url ?? ''),
        toCsvCell(item.provider ?? ''),
        toCsvCell(item.error ?? ''),
        toCsvCell(item.queried_at ? new Date(item.queried_at).toISOString() : ''),
      ].join(','),
    )
    const csv = [headers.map(toCsvCell).join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `rank-results-${selectedJobId || 'latest'}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div id="page-rank" className="page page-active">
      <div className="page-header linear-page-header">
        <div>
          <div className="page-title">{copy.title}</div>
          <div className="page-desc">{copy.desc}</div>
        </div>
        <div className="linear-header-meta">
          <span>{language === 'zh' ? `本次关键词 ${keywordList.length}` : `Keywords ${keywordList.length}`}</span>
        </div>
      </div>

      <div className="page-body linear-workbench rank-linear-workbench">
        <section className="linear-left rank-left-panel">
          <div className="settings-status-strip" style={{ position: 'static', paddingTop: 0 }}>
            <span className={hasSerpApi ? 'status-chip ready' : 'status-chip warn'}>
              SerpAPI: {hasSerpApi ? (language === 'zh' ? '可用' : 'Ready') : (language === 'zh' ? '未配置' : 'Missing')}
            </span>
            <span className={rankDomain ? 'status-chip ready' : 'status-chip warn'}>
              {language === 'zh' ? '目标域名：' : 'Target Domain: '}
              {rankDomain || (language === 'zh' ? '未配置' : 'Missing')}
            </span>
            <span className="status-chip muted">
              {language === 'zh' ? '本次关键词：' : 'Keywords: '}
              {keywordList.length}
            </span>
            <span className="status-chip muted">
              {language === 'zh' ? '上次执行：' : 'Last run: '}
              {lastRunAt ? new Date(lastRunAt).toLocaleString() : '-'}
            </span>
          </div>

          {!rankReady ? (
            <div className="alert alert-warn">
              <div>{jobsMessage || (language === 'zh' ? '请先在设置页配置 SerpAPI Key 与默认目标域名。' : 'Please configure SerpAPI key and default target domain in Settings.')}</div>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('/settings')}>
                {language === 'zh' ? '打开设置' : 'Open Settings'}
              </button>
            </div>
          ) : null}

          <div className="rank-section">
            <div className="linear-panel-title">{copy.keywords} · {keywordList.length}</div>
            <div className="linear-inspector-grid">
              <div className="field-block">
                <label>{copy.keywords}</label>
                <textarea
                  rows={8}
                  className="rank-kws-textarea"
                  value={keywordsText}
                  onChange={(event) => setKeywordsText(event.target.value)}
                  placeholder={'industrial router\n5G industrial router\nIoT gateway'}
                ></textarea>
              </div>
              <div className="rank-action-row">
                <button className="btn btn-sm" onClick={loadKeywords}>{copy.importLibrary}</button>
                <button className="btn btn-sm" onClick={() => setKeywordsText('')}>{language === 'zh' ? '清空关键词' : 'Clear Keywords'}</button>
                <button className="btn btn-sm" onClick={() => setShowLibraryPanel((current) => !current)}>
                  {showLibraryPanel ? (language === 'zh' ? '收起点选区' : 'Hide Picker') : (language === 'zh' ? '展开点选区' : 'Show Picker')}
                </button>
              </div>
              {showLibraryPanel ? (
                <div className="field-block">
                  <label>{language === 'zh' ? '点选关键词（支持多选）' : 'Select Keywords (multi-select)'}</label>
                  <input
                    type="text"
                    value={librarySearch}
                    onChange={(event) => setLibrarySearch(event.target.value)}
                    placeholder={language === 'zh' ? '筛选关键词' : 'Filter keywords'}
                  />
                  <div className="aw-kw-chips" style={{ marginTop: 8, maxHeight: 140, overflow: 'auto' }}>
                    {!filteredLibraryKeywords.length ? (
                      <span className="muted-text">{language === 'zh' ? '关键词库为空或无匹配' : 'No keywords in library or no match'}</span>
                    ) : (
                      filteredLibraryKeywords.slice(0, 200).map((keyword) => (
                        <span
                          key={keyword}
                          className={`chip ${keywordSet.has(keyword.toLowerCase()) ? 'sel' : ''}`}
                          onClick={() => toggleKeyword(keyword)}
                          title={keyword}
                        >
                          {keyword}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rank-section">
            <button className="btn btn-sm" onClick={() => setShowAdvanced((current) => !current)}>
              {showAdvanced ? (language === 'zh' ? '收起高级设置' : 'Hide Advanced') : (language === 'zh' ? '高级设置' : 'Advanced Settings')}
            </button>
            {showAdvanced ? (
              <div className="linear-inspector-grid rank-form-grid" style={{ marginTop: 10 }}>
                <div className="field-block">
                  <label>{copy.pages}</label>
                  <select value={maxPages} onChange={(event) => setMaxPages(event.target.value)}>
                    <option value="3">3</option>
                    <option value="5">5</option>
                    <option value="10">10</option>
                  </select>
                </div>
                <div className="field-block">
                  <label>{copy.region}</label>
                  <select value={region} onChange={(event) => setRegion(event.target.value)}>
                    <option value="us">US</option>
                    <option value="gb">GB</option>
                    <option value="de">DE</option>
                    <option value="cn">CN</option>
                    <option value="">All</option>
                  </select>
                </div>
                <div className="field-block">
                  <label>HL</label>
                  <select value={hl} onChange={(event) => setHl(event.target.value)}>
                    <option value="en">en</option>
                    <option value="zh-cn">zh-cn</option>
                    <option value="de">de</option>
                  </select>
                </div>
                <div className="field-block">
                  <label>Results / Request</label>
                  <select value={resultsPerRequest} onChange={(event) => setResultsPerRequest(event.target.value)}>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
            ) : null}
          </div>

          <button className="btn btn-primary btn-full" onClick={startTracking} disabled={!canTrack}>
            {running ? t.common.generating : copy.start}
          </button>
          {error ? <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div> : null}
          {jobsStatus === 'configuration_required' && jobsMessage ? <div className="alert alert-warn" style={{ marginTop: 10 }}>{jobsMessage}</div> : null}
        </section>

        <section className="linear-main rank-main-panel">
          <div className="linear-table-tools">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search keyword / url / error" />
            <select value={foundFilter} onChange={(event) => setFoundFilter(event.target.value as 'all' | 'found' | 'not_found')}>
              <option value="all">All</option>
              <option value="found">Found</option>
              <option value="not_found">Not found</option>
            </select>
            <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} className="rank-job-select">
              <option value="">{language === 'zh' ? '选择追踪批次' : 'Select Job'}</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {(job.domain || '-') + ' · ' + (job.provider || 'serpapi')}
                </option>
              ))}
            </select>
            <button className="btn btn-sm" onClick={exportCsv} disabled={!filteredResults.length}>Export CSV</button>
          </div>
          <div className="linear-table-wrap">
            <table className="tbl linear-table table-comfort">
              <thead><tr>{copy.cols.map((label) => <th key={label}>{label}</th>)}</tr></thead>
              <tbody>
                {!pagedResults.length ? (
                  <tr><td colSpan={5}><div className="empty">{copy.noResults}</div></td></tr>
                ) : pagedResults.map((item, index) => (
                  <tr key={`${item.keyword}-${index}`}>
                    <td>{item.keyword}</td>
                    <td>{item.found ? String(item.position || '-') : '-'}</td>
                    <td>{item.found ? String(item.page || '-') : '-'}</td>
                    <td title={item.url || ''}>{item.url || item.error || '-'}</td>
                    <td>{item.queried_at ? new Date(item.queried_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="linear-table-footer">
            <span>{filteredResults.length} rows</span>
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
      </div>
    </div>
  )
}
