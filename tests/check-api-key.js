const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000'

async function main() {
  const response = await fetch(`${baseUrl}/api/settings`)
  if (!response.ok) {
    throw new Error(`/api/settings failed with ${response.status}`)
  }

  const data = await response.json()
  const settings = data.settings || {}
  const platform = {
    ai: Boolean(settings.ai_available),
    rank: Boolean(settings.rank_available),
    indexing: Boolean(settings.indexing_available),
    activeModel: settings.active_ai_model_label || '',
  }

  console.log(JSON.stringify({ baseUrl, platform }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
