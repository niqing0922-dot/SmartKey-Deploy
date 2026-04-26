import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { rankApi, settingsApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'
import { Alert, EmptyState } from '@/components/ui/States'
import { consumeWorkbenchTaskDraft } from '@/lib/workbenchDrafts'
import type { RankJobItem, RankMatrixRow, RankResultItem, RankTemplatePreview, SettingsItem } from '@/types'

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const payload = result.split(',')[1] || ''
      resolve(payload)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function latestResultText(result?: RankResultItem | null) {
  if (!result) return '/--/'
  return result.display_rank || '/--/'
}

type MatrixFilter = 'all' | 'latest_found' | 'latest_missed' | 'miss_streak'

export function RankPage() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const copy = t.rank

  const [settings, setSettings] = useState<SettingsItem | null>(null)
  const [jobs, setJobs] = useState<RankJobItem[]>([])
  const [jobsStatus, setJobsStatus] = useState('')
  const [jobsMessage, setJobsMessage] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [selectedJob, setSelectedJob] = useState<RankJobItem | null>(null)

  const [uploadedTemplate, setUploadedTemplate] = useState<{ filename: string; content_base64: string } | null>(null)
  const [templatePreview, setTemplatePreview] = useState<RankTemplatePreview | null>(null)
  const [matrixColumns, setMatrixColumns] = useState<string[]>([])
  const [matrixRows, setMatrixRows] = useState<RankMatrixRow[]>([])
  const [selectedKeyword, setSelectedKeyword] = useState<RankMatrixRow | null>(null)
  const [singleKeyword, setSingleKeyword] = useState('')
  const [singleKeywordResult, setSingleKeywordResult] = useState<RankResultItem | null>(null)

  const [domain, setDomain] = useState('')
  const [provider, setProvider] = useState('serpapi')
  const [maxPages, setMaxPages] = useState('10')
  const [hl, setHl] = useState('en')
  const [gl, setGl] = useState('us')
  const [search, setSearch] = useState('')
  const [matrixFilter, setMatrixFilter] = useState<MatrixFilter>('all')
  const [runningBatch, setRunningBatch] = useState(false)
  const [runningSingle, setRunningSingle] = useState(false)
  const [error, setError] = useState('')

  const rankReady = Boolean(settings?.serpapi_enabled && settings?.serpapi_key_configured && (domain || settings?.rank_target_domain))

  const batchJobs = useMemo(
    () => jobs.filter((job) => job.summary?.mode === 'batch_template_run'),
    [jobs],
  )

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return matrixRows.filter((row) => {
      if (query && !row.keyword.toLowerCase().includes(query)) return false
      if (matrixFilter === 'latest_found') return row.latest_found
      if (matrixFilter === 'latest_missed') return !row.latest_found
      if (matrixFilter === 'miss_streak') return row.miss_streak >= 2
      return true
    })
  }, [matrixFilter, matrixRows, search])

  const loadJobs = async () => {
    const response = await rankApi.jobs()
    const items = (response?.items || []) as RankJobItem[]
    setJobs(items)
    setJobsStatus(response?.status || '')
    setJobsMessage(response?.message || '')
    if (!selectedJobId && items[0]?.id) setSelectedJobId(items[0].id)
  }

  useEffect(() => {
    Promise.all([settingsApi.get(), loadJobs()])
      .then(([settingsData]) => {
        setSettings(settingsData)
        setDomain(settingsData.rank_target_domain || '')
      })
      .catch((issue: any) => setError(issue?.response?.data?.detail?.message || issue?.message || 'Failed to load rank page'))
  }, [])

  useEffect(() => {
    const draft = consumeWorkbenchTaskDraft('rank-tracker')
    if (draft?.prefill) {
      if (typeof draft.prefill.keyword === 'string') setSingleKeyword(draft.prefill.keyword)
      if (typeof draft.prefill.provider === 'string') setProvider(draft.prefill.provider)
      return
    }
    const raw = window.localStorage.getItem('smartkey.global.rank')
    if (!raw) return
    try {
      const legacy = JSON.parse(raw)
      if (typeof legacy.keyword === 'string') setSingleKeyword(legacy.keyword)
    } finally {
      window.localStorage.removeItem('smartkey.global.rank')
    }
  }, [])

  useEffect(() => {
    if (!selectedJobId) return
    rankApi.results(selectedJobId)
      .then((response) => {
        const job = response?.item as RankJobItem
        setSelectedJob(job)
        const matrix = job?.summary?.matrix
        if (matrix?.columns?.length && matrix?.rows?.length) {
          setMatrixColumns(matrix.columns)
          setMatrixRows(matrix.rows)
          setSelectedKeyword(matrix.rows[0] || null)
        }
      })
      .catch(() => undefined)
  }, [selectedJobId])

  const onTemplateChosen = async (file?: File | null) => {
    if (!file) return
    setError('')
    try {
      const content_base64 = await fileToBase64(file)
      const payload = { filename: file.name, content_base64 }
      setUploadedTemplate(payload)
      const previewResponse = await rankApi.previewTemplate({ file: payload })
      setTemplatePreview(previewResponse.preview)
    } catch (issue: any) {
      setError(issue?.response?.data?.detail?.message || issue?.message || 'Failed to read template file')
    }
  }

  const runBatchTracking = async () => {
    if (!uploadedTemplate || !rankReady) return
    setRunningBatch(true)
    setError('')
    try {
      const response = await rankApi.run({
        mode: 'batch_template_run',
        template_file: uploadedTemplate,
        domain,
        provider,
        max_pages: Number(maxPages) || 10,
        results_per_request: 100,
        hl,
        gl,
        source: 'template_upload',
      })
      setMatrixColumns(response?.columns || [])
      setMatrixRows(response?.rows || [])
      setSelectedKeyword((response?.rows || [])[0] || null)
      setSelectedJobId(response?.job_id || '')
      await loadJobs()
    } catch (issue: any) {
      setError(issue?.response?.data?.detail?.message || issue?.message || 'Failed to run template tracking')
    } finally {
      setRunningBatch(false)
    }
  }

  const runSingleKeyword = async () => {
    if (!singleKeyword.trim() || !rankReady) return
    setRunningSingle(true)
    setError('')
    try {
      const response = await rankApi.run({
        mode: 'single_keyword_check',
        keywords: [singleKeyword.trim()],
        domain,
        provider,
        max_pages: Number(maxPages) || 10,
        results_per_request: 100,
        hl,
        gl,
        source: 'single_keyword',
      })
      setSingleKeywordResult((response?.results || [])[0] || null)
      await loadJobs()
    } catch (issue: any) {
      setError(issue?.response?.data?.detail?.message || issue?.message || 'Failed to check keyword rank')
    } finally {
      setRunningSingle(false)
    }
  }

  const outputJobId = selectedJob?.summary?.mode === 'batch_template_run' ? selectedJob.id : batchJobs[0]?.id || ''
  const outputSummary = selectedJob?.summary?.mode === 'batch_template_run' ? selectedJob.summary : batchJobs[0]?.summary

  return (
    <div id="page-rank" className="page page-active">
      <div className="page-header linear-page-header">
        <div>
          <div className="page-title">{copy.title}</div>
          <div className="page-desc">{copy.desc}</div>
        </div>
        <div className="linear-header-meta">
          <span>{copy.keywordCount}: {templatePreview?.keyword_count || matrixRows.length || 0}</span>
          <span>{language === 'zh' ? '模板优先' : 'Template-first'}</span>
        </div>
      </div>

      <div className="page-body linear-workbench rank-workbench-v2">
        <section className="linear-left rank-v2-left">
          <div className="settings-status-strip" style={{ position: 'static', paddingTop: 0 }}>
            <span className={rankReady ? 'status-chip ready' : 'status-chip warn'}>
              SerpAPI: {rankReady ? (language === 'zh' ? '可用' : 'Ready') : (language === 'zh' ? '未配置' : 'Missing')}
            </span>
            <span className={domain ? 'status-chip ready' : 'status-chip warn'}>
              {copy.domain}: {domain || '-'}
            </span>
          </div>

          {!rankReady ? (
            <Alert tone="warn">
              <div>{jobsMessage || copy.setupRequired}</div>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('/settings')}>
                {copy.openSettings}
              </button>
            </Alert>
          ) : null}

          <div className="rank-v2-panel">
            <div className="linear-panel-title">{copy.upload}</div>
            <div className="muted-text" style={{ marginBottom: 10 }}>
              {language === 'zh'
                ? '先上传 Excel 模板，再批量更新关键词的历史排名矩阵。'
                : 'Upload the Excel template first, then update the keyword history matrix in batch.'}
            </div>
            <label className="rank-upload-dropzone">
              <input type="file" accept=".xlsx" onChange={(event) => onTemplateChosen(event.target.files?.[0] || null)} />
              <strong>{copy.dropHint}</strong>
              <span>{uploadedTemplate?.filename || copy.templateEmpty}</span>
            </label>
            {templatePreview ? (
              <div className="rank-template-meta">
                <div><span>{copy.sheetName}</span><strong>{templatePreview.sheet_name}</strong></div>
                <div><span>{copy.keywordCount}</span><strong>{templatePreview.keyword_count}</strong></div>
                <div><span>{copy.historyColumns}</span><strong>{templatePreview.history_column_count}</strong></div>
              </div>
            ) : null}
          </div>

          <div className="rank-v2-panel">
            <div className="linear-panel-title">{copy.templateSummary}</div>
            {!templatePreview ? (
              <EmptyState
                title={language === 'zh' ? '还没有模板' : 'No template yet'}
                description={copy.templateEmpty}
              />
            ) : (
              <div className="rank-summary-stack">
                <div className="rank-summary-list">
                  {templatePreview.keyword_preview.map((keyword) => (
                    <div key={keyword} className="rank-summary-item">{keyword}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rank-v2-panel">
            <div className="muted-text" style={{ marginBottom: 10 }}>
              {language === 'zh'
                ? '这些参数会同时用于模板批量更新和单关键词检查。'
                : 'These settings apply to both template batch runs and single keyword checks.'}
            </div>
            <div className="rank-config-grid">
              <div className="field-block">
                <label>{copy.domain}</label>
                <input value={domain} onChange={(event) => setDomain(event.target.value)} />
              </div>
              <div className="field-block">
                <label>{copy.provider}</label>
                <select value={provider} onChange={(event) => setProvider(event.target.value)}>
                  <option value="serpapi">serpapi</option>
                </select>
              </div>
              <div className="field-block">
                <label>{copy.pages}</label>
                <select value={maxPages} onChange={(event) => setMaxPages(event.target.value)}>
                  <option value="10">10</option>
                  <option value="5">5</option>
                  <option value="3">3</option>
                </select>
              </div>
              <div className="field-block">
                <label>{copy.languageCode}</label>
                <select value={hl} onChange={(event) => setHl(event.target.value)}>
                  <option value="en">en</option>
                  <option value="zh-cn">zh-cn</option>
                  <option value="de">de</option>
                </select>
              </div>
              <div className="field-block">
                <label>{copy.region}</label>
                <select value={gl} onChange={(event) => setGl(event.target.value)}>
                  <option value="us">us</option>
                  <option value="gb">gb</option>
                  <option value="de">de</option>
                  <option value="">all</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary btn-full" onClick={runBatchTracking} disabled={!uploadedTemplate || !rankReady || runningBatch}>
              {runningBatch ? copy.runningBatch : copy.runBatch}
            </button>
          </div>

          {outputSummary?.output_file ? (
            <div className="rank-v2-panel">
              <div className="linear-panel-title">{copy.latestOutput}</div>
              <div className="rank-output-meta">
                <div><span>{copy.newDateColumn}</span><strong>{outputSummary.new_date_column || '-'}</strong></div>
                <div><span>{copy.keywordCount}</span><strong>{outputSummary.keyword_count || outputSummary.total || 0}</strong></div>
                <div><span>Found / Miss</span><strong>{outputSummary.found || 0} / {outputSummary.notFound || 0}</strong></div>
                <div><span>Error</span><strong>{outputSummary.errors || 0}</strong></div>
              </div>
              <div className="btn-group">
                <a className="btn btn-sm" href={outputJobId ? rankApi.artifactUrl(outputJobId, 'xlsx') : '#'}>{copy.exportXlsx}</a>
                <a className="btn btn-sm" href={outputJobId ? rankApi.artifactUrl(outputJobId, 'csv') : '#'}>{copy.exportCsv}</a>
              </div>
            </div>
          ) : null}

          {error ? <Alert tone="error">{error}</Alert> : null}
          {jobsStatus === 'configuration_required' && jobsMessage ? <Alert tone="warn">{jobsMessage}</Alert> : null}
        </section>

        <section className="linear-main rank-v2-main">
          <div className="rank-matrix-toolbar">
            <div className="linear-panel-title">{copy.matrixTitle}</div>
            <div className="rank-matrix-actions">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.matrixSearch} />
              <select value={matrixFilter} onChange={(event) => setMatrixFilter(event.target.value as MatrixFilter)}>
                <option value="all">{copy.filterAll}</option>
                <option value="latest_found">{copy.filterLatestFound}</option>
                <option value="latest_missed">{copy.filterLatestMissed}</option>
                <option value="miss_streak">{copy.filterMissStreak}</option>
              </select>
            </div>
          </div>

          {!matrixColumns.length || !matrixRows.length ? (
            <EmptyState
              title={language === 'zh' ? '还没有历史矩阵' : 'No history matrix yet'}
              description={copy.noMatrix}
            />
          ) : (
            <>
              <div className="rank-matrix-wrap">
                <table className="tbl linear-table rank-history-table">
                  <thead>
                    <tr>
                      <th className="sticky-col">Keyword</th>
                      {matrixColumns.map((column) => <th key={column}>{column}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.keyword} className={selectedKeyword?.keyword === row.keyword ? 'is-selected' : ''} onClick={() => setSelectedKeyword(row)}>
                        <td className="sticky-col rank-keyword-cell">
                          <strong>{row.keyword}</strong>
                          <span>{latestResultText(row.latest_result)}</span>
                        </td>
                        {row.values.map((value, index) => (
                          <td
                            key={`${row.keyword}-${matrixColumns[index]}`}
                            className={`rank-value-cell ${value === '/--/' ? 'missed' : value.startsWith('1--') || value.startsWith('2--') || value.startsWith('3--') ? 'top' : 'found'}`}
                          >
                            {value || '/--/'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedKeyword ? (
                <div className="rank-keyword-detail">
                  <div className="rank-detail-head">
                    <div>
                      <div className="linear-panel-title">{copy.detailsTitle}</div>
                      <div className="rank-detail-keyword">{selectedKeyword.keyword}</div>
                    </div>
                    <span className={`status-chip ${selectedKeyword.latest_found ? 'ready' : 'muted'}`}>{selectedKeyword.latest_value || '/--/'}</span>
                  </div>

                  <div className="rank-detail-grid">
                    <div className="rank-detail-card">
                      <div className="rank-detail-title">{copy.latestResult}</div>
                      {selectedKeyword.latest_result ? (
                        <div className="rank-detail-body">
                          <div><span>URL</span><strong>{selectedKeyword.latest_result.url || '-'}</strong></div>
                          <div><span>Page</span><strong>{selectedKeyword.latest_result.page ?? '-'}</strong></div>
                          <div><span>Position</span><strong>{selectedKeyword.latest_result.position ?? '-'}</strong></div>
                          <div><span>Provider</span><strong>{selectedKeyword.latest_result.provider || '-'}</strong></div>
                          <div><span>Queried</span><strong>{selectedKeyword.latest_result.queried_at ? new Date(selectedKeyword.latest_result.queried_at).toLocaleString() : '-'}</strong></div>
                          {selectedKeyword.latest_result.error ? <div><span>Error</span><strong>{selectedKeyword.latest_result.error}</strong></div> : null}
                        </div>
                      ) : (
                        <div className="muted-text">-</div>
                      )}
                    </div>
                    <div className="rank-detail-card">
                      <div className="rank-detail-title">{copy.historyTrail}</div>
                      <div className="rank-history-stack">
                        {selectedKeyword.history_items.map((item) => (
                          <div key={`${selectedKeyword.keyword}-${item.column}`} className="rank-history-item">
                            <span>{item.column}</span>
                            <strong>{item.value || '/--/'}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        <aside className="linear-right rank-v2-right">
          <div className="rank-v2-panel">
            <div className="linear-panel-title">{copy.recentJobs}</div>
            {!batchJobs.length ? (
              <div className="muted-text">{copy.noJobs}</div>
            ) : (
              <div className="rank-job-stack">
                {batchJobs.map((job) => (
                  <button key={job.id} className={`rank-job-card ${selectedJobId === job.id ? 'active' : ''}`} onClick={() => setSelectedJobId(job.id)}>
                    <div className="rank-job-title">{job.summary?.template_preview?.filename || job.summary?.input_file || job.domain}</div>
                    <div className="rank-job-sub">{job.finished_at ? new Date(job.finished_at).toLocaleString() : '-'}</div>
                    <div className="rank-job-stats">
                      <span>#{job.summary?.keyword_count || job.summary?.total || 0}</span>
                      <span>{job.summary?.found || 0} / {job.summary?.notFound || 0}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rank-v2-panel">
            <div className="linear-panel-title">{copy.singleTitle}</div>
            <div className="muted-text" style={{ marginBottom: 10 }}>
              {language === 'zh'
                ? '单关键词查询不会覆盖当前矩阵，只用于快速验证。'
                : 'Single keyword checks do not replace the current matrix. Use them for quick validation.'}
            </div>
            <div className="field-block">
              <input value={singleKeyword} onChange={(event) => setSingleKeyword(event.target.value)} placeholder={copy.singlePlaceholder} />
            </div>
            <button className="btn btn-sm btn-primary btn-full" onClick={runSingleKeyword} disabled={!rankReady || !singleKeyword.trim() || runningSingle}>
              {runningSingle ? copy.singleRunning : copy.singleRun}
            </button>
            {!singleKeywordResult ? (
              <div className="muted-text" style={{ marginTop: 10 }}>{copy.singleEmpty}</div>
            ) : (
              <div className="rank-single-result">
                <div className="rank-single-head">
                  <strong>{singleKeywordResult.keyword}</strong>
                  <span className={`status-chip ${singleKeywordResult.found ? 'ready' : 'muted'}`}>{singleKeywordResult.display_rank}</span>
                </div>
                <div className="rank-single-grid">
                  <div><span>URL</span><strong>{singleKeywordResult.url || '-'}</strong></div>
                  <div><span>Page</span><strong>{singleKeywordResult.page ?? '-'}</strong></div>
                  <div><span>Position</span><strong>{singleKeywordResult.position ?? '-'}</strong></div>
                  <div><span>Provider</span><strong>{singleKeywordResult.provider || '-'}</strong></div>
                </div>
              </div>
            )}
          </div>

          <div className="rank-v2-panel">
            <div className="linear-panel-title">{language === 'zh' ? '工作建议' : 'Working Notes'}</div>
            <div className="ai-home-principles">
              <div className="ai-home-principle">
                <strong>{language === 'zh' ? '先模板，后单查' : 'Template first, single checks second'}</strong>
                <span>{language === 'zh' ? '先用模板建立历史矩阵，再用单关键词验证波动项。' : 'Build the history matrix with the template first, then use single checks to inspect volatile terms.'}</span>
              </div>
              <div className="ai-home-principle">
                <strong>{language === 'zh' ? '把它当成可选模块' : 'Treat this as optional'}</strong>
                <span>{language === 'zh' ? 'Rank 模块不应该阻塞关键词库、文章追踪和 GEO Writer 的本地工作。' : 'Rank should never block the local keyword, article, or GEO Writer workflows.'}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
