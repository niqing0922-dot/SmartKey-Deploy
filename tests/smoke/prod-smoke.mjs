const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000'

async function assertJson(path) {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`)
  return response.json()
}

async function assertText(path, expectedFragment) {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`)
  const text = await response.text()
  if (!text.includes(expectedFragment)) {
    throw new Error(`${path} did not include expected fragment: ${expectedFragment}`)
  }
  return text
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

  await assertText('/', '<div id="root"></div>')
  await assertText('/keywords', '<div id="root"></div>')
  await assertText('/articles/geo-writer', '<div id="root"></div>')
  await assertText('/settings', '<div id="root"></div>')

  console.log(JSON.stringify({ baseUrl, status: 'ok' }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
