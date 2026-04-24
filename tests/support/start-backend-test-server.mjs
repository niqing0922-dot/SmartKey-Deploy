import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const port = process.argv[2] || '3000'
const root = process.cwd()
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'smartkey-test-'))
const dataDir = path.join(tmpRoot, 'data')
const backupDir = path.join(tmpRoot, 'backups')
const logDir = path.join(root, '.artifacts', 'logs')

fs.mkdirSync(dataDir, { recursive: true })
fs.mkdirSync(backupDir, { recursive: true })
fs.mkdirSync(logDir, { recursive: true })

const child = spawn(
  process.env.SMARTKEY_PYTHON || 'python',
  ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(port)],
  {
    cwd: root,
    env: {
      ...process.env,
      SMARTKEY_DATA_DIR: dataDir,
      SMARTKEY_BACKUP_DIR: backupDir,
      SMARTKEY_LOG_DIR: logDir,
    },
    stdio: 'inherit',
  },
)

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal)
  }
}

process.on('SIGINT', () => forwardSignal('SIGINT'))
process.on('SIGTERM', () => forwardSignal('SIGTERM'))
child.on('exit', (code) => process.exit(code ?? 0))
