import { useEffect, useMemo, useState } from 'react'
import { SmartKeyLogo } from '@/components/brand/SmartKeyLogo'
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

const workflowCards = [
  ['Keyword Library', 'Cluster BOFU, competitor, scenario, and question keywords before writing.'],
  ['GEO Writer', 'Generate briefs, outlines, FAQ blocks, and article sections from local intent data.'],
  ['Local Data', 'Keep content, backups, and settings on your machine with graceful optional integrations.'],
]

const proofItems = [
  ['Login-free', 'Open the product directly and start from the workbench.'],
  ['Backend-first', 'AI and indexing providers stay isolated behind local APIs.'],
  ['Portable', 'The first release target is a Windows x64 package.'],
]

const faqs = [
  ['Is SmartKey cloud-only?', 'No. The rebuilt app is local-first and does not require login for the default workflow.'],
  ['What can I download now?', 'The current target is a Windows x64 portable package. If no asset is configured, the button opens GitHub releases.'],
  ['Where do API keys live?', 'Optional AI, rank, and indexing credentials are configured through backend settings, not called directly from the frontend.'],
]

function formatBytes(value: number) {
  if (!value) return 'Release asset'
  const size = value / 1024 / 1024
  return `${size.toFixed(size >= 10 ? 0 : 1)} MB`
}

export function ShowcasePage() {
  const [download, setDownload] = useState<DownloadInfo>(fallbackDownload)
  const [downloadCheckFailed, setDownloadCheckFailed] = useState(false)
  const configuredUrl = String(import.meta.env.VITE_SMARTKEY_DOWNLOAD_URL || '').trim()

  useEffect(() => {
    let cancelled = false
    downloadsApi.latest()
      .then((item) => {
        if (!cancelled) {
          setDownload(item)
          setDownloadCheckFailed(false)
        }
      })
      .catch(() => {
        if (!cancelled) setDownloadCheckFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const downloadUrl = useMemo(() => {
    if (configuredUrl) return configuredUrl
    if (download.available && download.downloadUrl) return download.downloadUrl
    return githubReleaseUrl
  }, [configuredUrl, download.available, download.downloadUrl])

  const hasDirectDownload = Boolean(configuredUrl || (download.available && download.downloadUrl))
  const releaseStatus = hasDirectDownload ? 'Direct download ready' : 'Release page fallback'
  const primaryCtaText = hasDirectDownload ? 'Download for Windows' : 'Open release page'
  const downloadHelpText = hasDirectDownload
    ? 'The package is available as a direct download. If the browser asks for confirmation, keep the zip file.'
    : 'No direct package is attached yet. The page automatically falls back to GitHub Releases so users can still find the latest build.'
  const fallbackSteps = hasDirectDownload
    ? ['Download the Windows zip package.', 'Extract it anywhere on your machine.', 'Run SmartKey.exe to start the app.']
    : ['Open the GitHub Releases page.', 'Expand the latest release Assets section.', 'Download SmartKey-portable.zip, then extract and run SmartKey.exe.']

  return (
    <main className="sk-download-page">
      <header className="sk-download-nav">
        <a href="/showcase" className="sk-download-brand" aria-label="SmartKey download page">
          <SmartKeyLogo compact />
          <span>SmartKey</span>
        </a>
        <nav aria-label="Download page navigation">
          <a href="#workflow">Workflow</a>
          <a href="#download">Download</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a className="sk-nav-cta" href={downloadUrl} download={hasDirectDownload && !configuredUrl}>
          Download
        </a>
      </header>

      <section className="sk-hero" id="download">
        <div className="sk-hero-copy">
          <p className="sk-eyebrow">Windows portable app</p>
          <h1>Download SmartKey</h1>
          <p>Local-first SEO and GEO workbench. No login required.</p>
          <div className="sk-hero-actions">
            <a className="sk-primary-cta" href={downloadUrl} download={hasDirectDownload && !configuredUrl}>
              {primaryCtaText}
            </a>
            <a className="sk-secondary-cta" href="/">
              Preview app
            </a>
          </div>
          <div className="sk-release-line">
            <span>{releaseStatus}</span>
            <span>{download.platform}</span>
            <span>{download.version}</span>
          </div>
          <div className={`sk-download-notice ${hasDirectDownload ? 'ready' : 'fallback'}`}>
            <strong>{hasDirectDownload ? 'Ready now' : 'Fallback active'}</strong>
            <span>{downloadCheckFailed ? 'Release check failed, so SmartKey is using the release page fallback. ' : ''}{downloadHelpText}</span>
          </div>
        </div>

        <div className="sk-product-frame" aria-label="SmartKey product preview">
          <div className="sk-window-bar">
            <span />
            <span />
            <span />
            <strong>SmartKey Workbench</strong>
          </div>
          <div className="sk-app-preview">
            <aside>
              <div className="sk-preview-brand">
                <SmartKeyLogo compact />
                <b>SmartKey</b>
              </div>
              {['Dashboard', 'Keywords', 'Articles', 'GEO Writer', 'Local Data'].map((item) => (
                <span className={item === 'Keywords' ? 'active' : ''} key={item}>{item}</span>
              ))}
            </aside>
            <section>
              <div className="sk-preview-header">
                <div>
                  <small>Keyword Library</small>
                  <strong>Commercial intent clusters</strong>
                </div>
                <button type="button">New keyword</button>
              </div>
              <div className="sk-preview-stats">
                <div><span>Total</span><b>40</b></div>
                <div><span>Planned</span><b>39</b></div>
                <div><span>Articles</span><b>12</b></div>
              </div>
              <div className="sk-preview-table">
                {['5g industrial router', 'teltonika alternative', 'remote scada router'].map((item, index) => (
                  <div key={item}>
                    <strong>{item}</strong>
                    <span>{index === 0 ? 'BOFU' : index === 1 ? 'Competitor' : 'Scenario'}</span>
                    <em>Planned</em>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="sk-release-card">
        <div>
          <p className="sk-eyebrow">Current release</p>
          <h2>SmartKey for Windows</h2>
          <p>Portable packaging keeps the install path simple while the product rebuild focuses on core local workflows.</p>
        </div>
        <dl>
          <div><dt>Version</dt><dd>{download.version}</dd></div>
          <div><dt>Platform</dt><dd>{download.platform}</dd></div>
          <div><dt>Package</dt><dd>{download.filename}</dd></div>
          <div><dt>Size</dt><dd>{formatBytes(download.sizeBytes)}</dd></div>
        </dl>
        <a className="sk-primary-cta" href={downloadUrl} download={hasDirectDownload && !configuredUrl}>
          {primaryCtaText}
        </a>
      </section>

      <section className="sk-workflow" id="workflow">
        <div className="sk-section-heading">
          <p className="sk-eyebrow">Core workflow first</p>
          <h2>A focused desktop flow for content operators.</h2>
        </div>
        <div className="sk-card-grid">
          {workflowCards.map(([title, body]) => (
            <article key={title}>
              <span />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sk-proof-strip">
        {proofItems.map(([title, body]) => (
          <article key={title}>
            <strong>{title}</strong>
            <span>{body}</span>
          </article>
        ))}
      </section>

      <section className="sk-install">
        <div>
          <p className="sk-eyebrow">Install flow</p>
          <h2>Download. Extract. Launch.</h2>
        </div>
        <ol>
          {fallbackSteps.map((step, index) => (
            <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>
          ))}
        </ol>
      </section>

      <section className="sk-faq" id="faq">
        <div>
          <p className="sk-eyebrow">FAQ</p>
          <h2>Details before installing.</h2>
        </div>
        <div className="sk-faq-list">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="sk-download-footer">
        <a href="/showcase" className="sk-download-brand">
          <SmartKeyLogo compact />
          <span>SmartKey</span>
        </a>
        <a href={downloadUrl} download={hasDirectDownload && !configuredUrl}>Download SmartKey</a>
      </footer>
    </main>
  )
}
