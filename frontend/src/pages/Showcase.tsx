import { useEffect, useMemo, useState } from 'react'
import { downloadsApi } from '@/services/api'
import type { DownloadInfo } from '@/types'

const githubReleaseUrl = 'https://github.com/niqing0922-dot/SmartKey-Deploy/releases'

const fallbackDownload: DownloadInfo = {
  available: false,
  version: '2.0.0',
  platform: 'Windows x64 Portable',
  filename: 'SmartKey-portable.zip',
  sizeBytes: 0,
  downloadUrl: '',
  updatedAt: '',
}

const featureCards = [
  ['Keyword library', 'Group BOFU, competitor, scenario, and question keywords before writing.'],
  ['GEO writer', 'Turn keyword intent into briefs, outlines, FAQ blocks, and draft sections.'],
  ['Local data', 'Keep your content database, backups, and settings on the machine first.'],
]

const faqs = [
  ['Is SmartKey cloud-only?', 'No. The core workbench is local-first and opens without login.'],
  ['What can I download now?', 'The first distribution target is a Windows x64 portable package.'],
  ['Where do API keys live?', 'Optional AI, rank, and indexing keys are configured in backend settings, not called directly from the frontend.'],
]

function formatBytes(value: number) {
  if (!value) return 'Release asset'
  const size = value / 1024 / 1024
  return `${size.toFixed(size >= 10 ? 0 : 1)} MB`
}

export function ShowcasePage() {
  const [download, setDownload] = useState<DownloadInfo>(fallbackDownload)
  const configuredUrl = String((import.meta as any).env?.VITE_SMARTKEY_DOWNLOAD_URL || '').trim()

  useEffect(() => {
    let cancelled = false
    downloadsApi.latest()
      .then((item) => {
        if (!cancelled) setDownload(item)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const downloadUrl = useMemo(() => {
    if (configuredUrl) return configuredUrl
    if (download.available && download.downloadUrl) return download.downloadUrl
    return githubReleaseUrl
  }, [configuredUrl, download.available, download.downloadUrl])

  const releaseStatus = configuredUrl || download.available ? 'Ready to download' : 'Hosted on releases'

  return (
    <main className="download-page glass-download-page">
      <header className="glass-nav">
        <a href="/showcase" className="glass-brand" aria-label="SmartKey download page">
          <span className="glass-brand-mark">S</span>
          <span>SmartKey</span>
        </a>
        <nav>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
          <a href="#download">Download</a>
        </nav>
        <a className="glass-nav-download" href={downloadUrl} download={download.available && !configuredUrl}>
          Download
        </a>
      </header>

      <section className="glass-hero" id="download">
        <p className="glass-pill">Windows portable app</p>
        <h1>The local-first desktop app for SEO and GEO work.</h1>
        <p className="glass-hero-copy">
          Build keyword libraries, draft GEO articles, and validate publishing work from one calm desktop workspace.
        </p>
        <div className="glass-hero-actions">
          <a className="glass-primary" href={downloadUrl} download={download.available && !configuredUrl}>
            Download SmartKey
          </a>
          <span>{releaseStatus}</span>
        </div>

        <div className="glass-product-shot" aria-label="SmartKey app preview">
          <div className="glass-window-top">
            <span></span>
            <span></span>
            <span></span>
            <strong>SmartKey Workbench</strong>
          </div>
          <div className="glass-window-body">
            <aside>
              <b>SmartKey</b>
              <span className="active">Keywords</span>
              <span>Articles</span>
              <span>GEO Writer</span>
              <span>Local Data</span>
            </aside>
            <section>
              <div className="glass-shot-head">
                <small>Keyword library</small>
                <strong>Commercial-intent clusters</strong>
              </div>
              <div className="glass-shot-stats">
                <div><span>Total</span><b>40</b></div>
                <div><span>Planned</span><b>39</b></div>
                <div><span>Published</span><b>0</b></div>
              </div>
              <div className="glass-shot-table">
                {['5g industrial router', 'teltonika alternative', 'remote scada router'].map((item) => (
                  <div key={item}>
                    <strong>{item}</strong>
                    <span>High intent</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="glass-download-card">
        <div>
          <p className="glass-pill">Current release</p>
          <h2>SmartKey for Windows</h2>
        </div>
        <dl>
          <div><dt>Version</dt><dd>{download.version}</dd></div>
          <div><dt>Platform</dt><dd>{download.platform}</dd></div>
          <div><dt>Package</dt><dd>{download.filename}</dd></div>
          <div><dt>Size</dt><dd>{formatBytes(download.sizeBytes)}</dd></div>
        </dl>
        <a className="glass-primary" href={downloadUrl} download={download.available && !configuredUrl}>
          Download SmartKey
        </a>
      </section>

      <section className="glass-feature-grid" id="features">
        {featureCards.map(([title, body]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="glass-split">
        <div>
          <p className="glass-pill">Install flow</p>
          <h2>Download. Extract. Launch.</h2>
          <p>SmartKey ships as a portable app first, so distribution stays simple while the core local workflow remains stable.</p>
        </div>
        <ol>
          <li>Download the Windows package.</li>
          <li>Extract the zip anywhere.</li>
          <li>Run SmartKey.exe.</li>
        </ol>
      </section>

      <section className="glass-faq" id="faq">
        <div>
          <p className="glass-pill">FAQ</p>
          <h2>Small answers before you install.</h2>
        </div>
        <div>
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="glass-footer">
        <span>SmartKey</span>
        <a href={downloadUrl} download={download.available && !configuredUrl}>Download SmartKey</a>
      </footer>
    </main>
  )
}
