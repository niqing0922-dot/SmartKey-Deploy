import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const stylesPath = path.join(root, 'frontend', 'src', 'app', 'styles.css')
const tokensPath = path.join(root, 'frontend', 'src', 'app', 'tokens.css')
const routesPath = path.join(root, 'frontend', 'src', 'app', 'routes.tsx')

const requiredFiles = [stylesPath, tokensPath, routesPath]
for (const filePath of requiredFiles) {
  if (!fs.existsSync(filePath)) {
    console.error(`Theme consistency check failed: missing ${path.relative(root, filePath)}`)
    process.exit(1)
  }
}

const styles = fs.readFileSync(stylesPath, 'utf8')
const tokens = fs.readFileSync(tokensPath, 'utf8')
const routes = fs.readFileSync(routesPath, 'utf8')

const requiredTokens = [
  '--surface-canvas',
  '--surface-workspace',
  '--border-default',
  '--text-primary',
  '--accent-primary',
]

const missingTokens = requiredTokens.filter((token) => !tokens.includes(token) && !styles.includes(token))
if (missingTokens.length > 0) {
  console.error(`Theme consistency check failed: missing tokens ${missingTokens.join(', ')}`)
  process.exit(1)
}

const requiredShellSelectors = ['.app', '.sidebar', '.main', '.nav-item', '.page-title']
const missingSelectors = requiredShellSelectors.filter((selector) => !styles.includes(selector))
if (missingSelectors.length > 0) {
  console.error(`Theme consistency check failed: missing selectors ${missingSelectors.join(', ')}`)
  process.exit(1)
}

const requiredRoutes = ['AIHomePage', 'DashboardPage', 'KeywordsPage', 'ArticlesPage', 'GeoWriterPage', 'SettingsPage']
const missingRoutes = requiredRoutes.filter((route) => !routes.includes(route))
if (missingRoutes.length > 0) {
  console.error(`Theme consistency check failed: missing route components ${missingRoutes.join(', ')}`)
  process.exit(1)
}

console.log('Theme consistency check passed without browser automation.')
