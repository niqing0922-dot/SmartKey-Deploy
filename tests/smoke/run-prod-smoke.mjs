import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000'

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

const server = spawn('node', ['./tests/support/start-backend-test-server.mjs', '3000'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
})

try {
  await waitForHealth(baseUrl)
  const smoke = spawn('node', ['./tests/smoke/prod-smoke.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, SMOKE_BASE_URL: baseUrl },
    stdio: 'inherit',
  })
  const exitCode = await new Promise((resolve) => smoke.on('exit', resolve))
  if (exitCode !== 0) {
    process.exit(exitCode ?? 1)
  }
} finally {
  server.kill('SIGTERM')
}
