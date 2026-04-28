import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000'

async function main() {
  const response = await fetch(`${baseUrl}/api/settings`)
  if (!response.ok) {
    throw new Error(`/api/settings failed with ${response.status}`)
  }

  const data = await response.json()
  const settings = data.settings || {}
  const configured = {
    minimax: Boolean(settings.minimax_api_key_configured),
    gemini: Boolean(settings.gemini_api_key_configured),
    openai: Boolean(settings.openai_api_key_configured),
    serpapi: Boolean(settings.serpapi_key_configured),
    indexing: Boolean(settings.google_credentials_path_configured),
  }

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${baseUrl}/settings`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('settings-save').waitFor({ timeout: 10000 })
  await browser.close()

  console.log(JSON.stringify({ baseUrl, configured }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
