import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tokenPath = path.join(root, 'frontend', 'src', 'app', 'tokens.css');
const stylesPath = path.join(root, 'frontend', 'src', 'app', 'styles.css');
const srcPath = path.join(root, 'frontend', 'src');

const tokenCss = readFileSync(tokenPath, 'utf8');
const stylesCss = readFileSync(stylesPath, 'utf8');

const requiredPatterns = [
  [/--color-neutral-100\s*:/, 'primitive color tokens'],
  [/--space-8\s*:/, 'primitive spacing tokens'],
  [/--surface-panel\s*:/, 'semantic surface tokens'],
  [/--text-primary\s*:/, 'semantic text tokens'],
  [/--button-primary-bg\s*:/, 'component button tokens'],
  [/--card-bg\s*:/, 'component card tokens'],
  [/\[data-theme="dark"\]/, 'dark theme overrides'],
  [/--bg:\s*var\(--surface-canvas\)/, 'legacy compatibility aliases'],
];

const failures = [];

if (!stylesCss.startsWith("@import './tokens.css';")) {
  failures.push('frontend/src/app/styles.css must import tokens.css as its first statement.');
}

for (const [pattern, label] of requiredPatterns) {
  if (!pattern.test(tokenCss)) {
    failures.push(`tokens.css is missing ${label}.`);
  }
}

const rawColorPattern = /(?:#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))/g;
const allowedFiles = new Set([
  path.normalize(tokenPath),
  path.normalize(stylesPath),
]);

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === 'dist' || entry === 'node_modules') continue;
      files.push(...walk(fullPath));
    } else if (/\.(css|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

const rawColorFindings = [];
for (const file of walk(srcPath)) {
  const normalized = path.normalize(file);
  if (allowedFiles.has(normalized)) continue;
  const content = readFileSync(file, 'utf8');
  const matches = content.match(rawColorPattern) ?? [];
  if (matches.length > 0) {
    rawColorFindings.push(`${path.relative(root, file)}: ${matches.slice(0, 5).join(', ')}`);
  }
}

if (rawColorFindings.length > 0) {
  failures.push(`Raw colors found outside the token source:\n${rawColorFindings.join('\n')}`);
}

const legacyStyleDebt = stylesCss.match(rawColorPattern)?.length ?? 0;

if (failures.length > 0) {
  console.error(`Design token check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Design token check passed. Legacy styles.css raw color debt: ${legacyStyleDebt}.`);
