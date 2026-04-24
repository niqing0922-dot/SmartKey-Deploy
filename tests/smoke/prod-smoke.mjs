import { chromium } from 'playwright'

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000'

async function assertJson(path) {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`)
  return response.json()
}

async function main() {
  await assertJson('/api/health')
  await assertJson('/api/health/readiness')
  await assertJson('/api/dashboard/stats')
  await assertJson('/api/db/keywords')
  await assertJson('/api/db/articles')
  await assertJson('/api/geo-writer/drafts')
  await assertJson('/api/local-data/summary')
  await assertJson('/api/settings')
  await assertJson('/api/diagnostics/runtime')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  const title = await page.locator('.page-title').textContent()
  if (!title) throw new Error('Dashboard title did not render.')
  await page.getByTestId('nav.keywords').click()
  await page.getByTestId('keywords.create-button').waitFor()
  await page.getByTestId('nav.articles').click()
  await page.getByTestId('articles.create-button').waitFor()
  await page.getByTestId('nav.articles.geo-writer').click()
  await page.getByTestId('geo.generate-button').waitFor()
  await page.getByTestId('nav.settings').click()
  await page.getByTestId('settings-save').waitFor()
  await page.getByTestId('nav.local-data').click()
  await page.getByTestId('local-data.backup-button').waitFor()
  await browser.close()
  console.log(JSON.stringify({ baseUrl, status: 'ok' }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
