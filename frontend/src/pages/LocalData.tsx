import { useEffect, useMemo, useState } from 'react'
import { localDataApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'
import { formatBytes, formatDate } from '@/lib/format'

export function LocalDataPage() {
  const { t } = useI18n()
  const copy = t.localData
  const [summary, setSummary] = useState<any>(null)
  const [backups, setBackups] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [importText, setImportText] = useState('')

  const load = async () => {
    const [summaryData, backupItems] = await Promise.all([localDataApi.summary(), localDataApi.backups()])
    setSummary(summaryData)
    setBackups(backupItems)
  }

  useEffect(() => { load() }, [])

  const exportJson = async () => {
    const data = await localDataApi.exportSnapshot()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'smartkey-export.json'
    link.click()
    URL.revokeObjectURL(url)
    setMessage(copy.exported)
  }

  const importSnapshot = async () => {
    if (!importText.trim()) return
    const parsed = JSON.parse(importText)
    await localDataApi.importSnapshot(parsed)
    setMessage(copy.imported)
    setImportText('')
    load()
  }

  const tableRows = useMemo(() => summary ? [
    [copy.tableRows[0], summary.table_counts.keywords],
    [copy.tableRows[1], summary.table_counts.articles],
    [copy.tableRows[2], summary.table_counts.geo_article_drafts],
  ] : [], [summary, copy.tableRows])

  return (
    <div id="page-local-data" className="page page-active">
      <div className="page-header"><div><div className="page-title">{copy.title}</div><div className="page-desc">{copy.desc}</div></div><div className="btn-group"><button className="btn" data-testid="local-data.export-button" onClick={exportJson}>{copy.exportJson}</button><button className="btn btn-primary" data-testid="local-data.backup-button" onClick={async () => { await localDataApi.backup(); await load(); setMessage(copy.createdBackup) }}>{copy.backup}</button></div></div>
      <div className="page-body local-data-grid">
        {message ? <div className="alert alert-success">{message}</div> : null}
        <div className="card"><div className="card-header"><div className="card-title">{copy.summary}</div></div>{summary ? <div className="metric-stack"><div className="list-row"><span>{copy.dbPath}</span><strong className="path-copy">{summary.database_path}</strong></div><div className="list-row"><span>{copy.backupDir}</span><strong className="path-copy">{summary.backup_dir}</strong></div><div className="list-row"><span>{copy.dbSize}</span><strong>{formatBytes(summary.size_bytes)}</strong></div>{tableRows.map(([label, value]) => <div className="list-row" key={String(label)}><span>{label}</span><strong>{value as any}</strong></div>)}</div> : null}</div>
        <div className="card"><div className="card-header"><div className="card-title">{copy.backups}</div></div>{!backups.length ? <div className="muted-text">{copy.noBackups}</div> : backups.map((item) => <div key={item.path} className="list-row"><div><strong>{item.name}</strong><div className="muted-text">{formatDate(item.modified_at)}</div></div><span>{formatBytes(item.size_bytes)}</span></div>)}</div>
        <div className="card"><div className="card-header"><div className="card-title">{copy.importSnapshot}</div></div><label>{copy.pasteJson}</label><textarea data-testid="local-data.import-textarea" rows={10} value={importText} onChange={(event) => setImportText(event.target.value)}></textarea><div className="article-panel-actions"><button className="btn btn-primary btn-sm" data-testid="local-data.import-button" onClick={importSnapshot}>{copy.importBtn}</button></div></div>
        <div className="card"><div className="card-header"><div className="card-title">{copy.danger}</div></div><div className="btn-group"><button className="btn btn-danger" data-testid="local-data.reset-content" onClick={async () => { await localDataApi.reset('content'); await load(); setMessage(copy.resetContentDone) }}>{copy.resetContent}</button><button className="btn btn-danger" data-testid="local-data.reset-all" onClick={async () => { await localDataApi.reset('all'); await load(); setMessage(copy.resetAllDone) }}>{copy.resetAll}</button></div></div>
      </div>
    </div>
  )
}
