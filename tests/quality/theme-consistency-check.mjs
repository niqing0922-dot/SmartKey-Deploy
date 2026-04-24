import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const root = process.cwd()
const distIndex = path.join(root, 'frontend', 'dist', 'index.html')
const port = process.env.THEME_CHECK_PORT || '3001'
const baseUrl = process.env.THEME_CHECK_BASE_URL || `http://127.0.0.1:${port}`

const routes = [
  '/',
  '/keywords',
  '/articles',
  '/articles/geo-writer',
  '/articles/image-planner',
  '/matrix',
  '/keywords/recommend',
  '/keywords/analyze',
  '/ai-chat',
  '/import',
  '/rank-tracker',
  '/indexing',
  '/local-data',
  '/settings',
]

async function waitForHealth(url, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(`${url}/api/health`)
      if (response.ok) return
    } catch {}
    await delay(1000)
  }
  throw new Error(`Server did not become ready at ${url}`)
}

async function scanRoute(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    window.localStorage.setItem('smartkey.theme', 'light')
    document.documentElement.setAttribute('data-theme', 'light')
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(250)

  return page.evaluate(() => {
    const isDark = (value) => {
      const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/)
      if (!match) return false
      const r = Number(match[1])
      const g = Number(match[2])
      const b = Number(match[3])
      const a = match[4] === undefined ? 1 : Number(match[4])
      if (a <= 0.2) return false
      return r < 45 && g < 55 && b < 75
    }
    const findings = []

    for (const element of document.querySelectorAll('body *')) {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      if (
        rect.width <= 20 ||
        rect.height <= 10 ||
        style.visibility === 'hidden' ||
        style.display === 'none' ||
        style.opacity === '0'
      ) {
        continue
      }

      if (!isDark(style.backgroundColor)) continue

      findings.push({
        tag: element.tagName.toLowerCase(),
        className: String(element.className || '').slice(0, 120),
        backgroundColor: style.backgroundColor,
        text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
      })
    }

    const uniqueFindings = []
    const seen = new Set()
    for (const finding of findings) {
      const key = `${finding.tag}|${finding.className}|${finding.backgroundColor}`
      if (seen.has(key)) continue
      seen.add(key)
      uniqueFindings.push(finding)
    }

    return uniqueFindings.slice(0, 8)
  })
}

if (!fs.existsSync(distIndex)) {
  console.error('Theme consistency check requires frontend/dist. Run npm run build:frontend first.')
  process.exit(1)
}

const server = spawn('node', ['./tests/support/start-backend-test-server.mjs', port], {
  cwd: root,
  env: process.env,
  stdio: 'ignore',
})

let browser

try {
  await waitForHealth(baseUrl)
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
  const failures = []

  for (const route of routes) {
    const findings = await scanRoute(page, route)
    if (findings.length > 0) {
      failures.push({ route, findings })
    }
  }

  if (failures.length > 0) {
    console.error(`Theme consistency check failed:\n${JSON.stringify(failures, null, 2)}`)
    process.exit(1)
  }

  console.log(`Theme consistency check passed for ${routes.length} routes.`)
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}
