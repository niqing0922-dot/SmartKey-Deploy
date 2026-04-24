import { useState } from 'react'
import { keywordsApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'

const templates: Record<string, string> = { iot: 'industrial router,longtail,蜂窝工业路由器\n5g industrial gateway,core,5G 工业网关\nedge computing router,scenario,边缘计算场景', mfg: 'smart factory network,longtail,智能工厂网络\nindustrial iot monitoring,scenario,工业物联网监控\nfactory edge gateway,core,工厂边缘网关', energy: 'remote utility monitoring,scenario,远程公用事业监控\nsubstation iot router,core,变电站工业路由器', transport: 'vehicle connectivity gateway,scenario,车载连接网关\nfleet router management,longtail,车队路由器管理', cloud: 'edge to cloud gateway,core,边缘到云网关\nindustrial vpn router,longtail,工业 VPN 路由器' }

export function ImportPage() {
  const { t } = useI18n()
  const copy = t.bulkImport
  const [text, setText] = useState('')
  const [defaultType, setDefaultType] = useState('longtail')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const loadTemplate = (key: string) => setText(templates[key] || '')
  const submit = async () => { setLoading(true); setMessage(''); try { const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); for (const row of rows) { const [keyword, rawType, notes] = row.split(',').map((part) => part?.trim()); if (!keyword) continue; await keywordsApi.create({ keyword, type: mapType(rawType) || defaultType as any, notes: notes || '', priority: 'medium', status: 'pending' }) } setMessage(copy.imported.replace('{count}', String(rows.length))); setText('') } finally { setLoading(false) } }
  return <div id="page-import" className="page page-active"><div className="page-header"><div><div className="page-title">{copy.title}</div><div className="page-desc">{copy.desc}</div></div></div><div className="page-body"><div className="card"><div className="card-header"><div className="card-title">{copy.textImport}</div></div><label>{copy.format}</label><textarea id="import-text" className="import-textarea" value={text} onChange={(event) => setText(event.target.value)} placeholder={copy.placeholder} /><div className="import-row"><select id="import-default-type" value={defaultType} onChange={(event) => setDefaultType(event.target.value)}><option value="longtail">{copy.defaultLongtail}</option><option value="core">{copy.defaultCore}</option><option value="scenario">{copy.defaultScenario}</option><option value="persona">{copy.defaultPersona}</option></select><button className="btn btn-primary" onClick={submit} disabled={loading}>{copy.submit}</button><span id="import-result" className="import-result">{message}</span></div></div><div className="card"><div className="card-header"><div className="card-title">{copy.templates}</div></div><p className="template-hint">{copy.hint}</p><div className="btn-group"><button className="btn btn-sm" onClick={() => loadTemplate('iot')}>IoT Connectivity</button><button className="btn btn-sm" onClick={() => loadTemplate('mfg')}>Smart Manufacturing</button><button className="btn btn-sm" onClick={() => loadTemplate('energy')}>Energy & Utility</button><button className="btn btn-sm" onClick={() => loadTemplate('transport')}>Transportation</button><button className="btn btn-sm" onClick={() => loadTemplate('cloud')}>Cloud & Edge</button></div></div></div></div>
}

function mapType(rawType?: string) { switch ((rawType || '').toLowerCase()) { case '核心词': case 'core': return 'core'; case '长尾词': case 'longtail': case 'long': return 'longtail'; case '场景词': case 'scenario': return 'scenario'; case '客户画像': case 'persona': return 'persona'; case '问答词': case 'qa': return 'qa'; case '竞品词': case 'competitor': return 'competitor'; case '品牌词': case 'brand': return 'brand'; default: return '' } }
