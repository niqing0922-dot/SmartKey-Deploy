import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const checks = [
  {
    file: 'README.md',
    forbidden: [/Express API/i, /local user login and persistence/i, /JWT_SECRET/i],
  },
  {
    file: path.join('docs', 'ARCHITECTURE.md'),
    forbidden: [/Express API/i, /authentication and authorization/i, /local user registration and login/i],
  },
]

const failures = []

for (const check of checks) {
  const content = fs.readFileSync(path.join(root, check.file), 'utf8')
  for (const pattern of check.forbidden) {
    if (pattern.test(content)) {
      failures.push(`${check.file}: found forbidden pattern ${pattern}`)
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('docs reality check passed')
