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
  {
    file: path.join('docs', 'PROJECT_STRUCTURE.md'),
    forbidden: [/Express API/i, /auth,/i, /backend\/src/i],
  },
  {
    file: 'TECH_DESIGN.md',
    forbidden: [/backend\/src/i, /redirecting to `\/login`/i, /auth_token/i],
  },
  {
    file: path.join('backend', 'README.md'),
    forbidden: [/Express API/i, /User registration and login/i, /JWT_SECRET/i, /npm install/i],
  },
  {
    file: path.join('backend', '.env.example'),
    forbidden: [/JWT_SECRET/i, /JWT_EXPIRES/i, /auth_token/i],
  },
  {
    file: path.join('tests', 'check-api-key.js'),
    forbidden: [/\/login/i, /auth_token/i, /localStorage\.getItem\('user'\)/i],
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
