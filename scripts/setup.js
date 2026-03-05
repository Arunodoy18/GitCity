#!/usr/bin/env node

/**
 * GitCity Setup Script
 *
 * Installs all dependencies and configures the project for development.
 *
 * Usage: node scripts/setup.js
 */

import { execSync } from 'child_process'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const log = (msg) => console.log(`\x1b[36m[GitCity]\x1b[0m ${msg}`)
const success = (msg) => console.log(`\x1b[32m  ✓\x1b[0m ${msg}`)
const warn = (msg) => console.log(`\x1b[33m  ⚠\x1b[0m ${msg}`)
const error = (msg) => console.log(`\x1b[31m  ✗\x1b[0m ${msg}`)

function run(cmd, cwd = ROOT) {
  try {
    execSync(cmd, { cwd, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function runVisible(cmd, cwd = ROOT) {
  try {
    execSync(cmd, { cwd, stdio: 'inherit' })
    return true
  } catch {
    return false
  }
}

console.log('')
console.log('  🏙️  GitCity Setup')
console.log('  ─────────────────')
console.log('')

// ─── 1. Check Node.js version ────────────────────────────────
log('Checking Node.js version...')
const nodeVersion = process.version.match(/^v(\d+)/)?.[1]
if (parseInt(nodeVersion) < 18) {
  error(`Node.js 18+ required (found ${process.version})`)
  process.exit(1)
}
success(`Node.js ${process.version}`)

// ─── 2. Install frontend dependencies ────────────────────────
log('Installing frontend dependencies...')
const frontendDir = resolve(ROOT, 'frontend')
if (existsSync(resolve(frontendDir, 'package.json'))) {
  runVisible('npm install', frontendDir)
  success('Frontend dependencies installed')
} else {
  warn('frontend/package.json not found — skipping')
}

// ─── 3. Install backend dependencies ─────────────────────────
log('Installing backend dependencies...')
const backendDir = resolve(ROOT, 'backend')
if (existsSync(resolve(backendDir, 'package.json'))) {
  runVisible('npm install', backendDir)
  success('Backend dependencies installed')
} else {
  warn('backend/package.json not found — skipping')
}

// ─── 4. Generate Prisma client ───────────────────────────────
log('Generating Prisma client...')
if (existsSync(resolve(backendDir, 'prisma', 'schema.prisma'))) {
  if (run('npx prisma generate', backendDir)) {
    success('Prisma client generated')
  } else {
    warn('Prisma generate failed — run manually: cd backend && npx prisma generate')
  }
} else {
  warn('No Prisma schema found — skipping')
}

// ─── 5. Create .env if missing ───────────────────────────────
log('Checking environment configuration...')
const envPath = resolve(backendDir, '.env')
const envExamplePath = resolve(backendDir, '.env.example')

if (!existsSync(envPath)) {
  if (existsSync(envExamplePath)) {
    const example = readFileSync(envExamplePath, 'utf-8')
    writeFileSync(envPath, example)
    success('Created backend/.env from .env.example')
    warn('Edit backend/.env with your GitHub OAuth credentials')
  } else {
    const defaultEnv = `PORT=5000
FRONTEND_URL=http://localhost:5173
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
JWT_SECRET=change-this-in-production
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gitcity?schema=public
REDIS_URL=redis://localhost:6379
`
    writeFileSync(envPath, defaultEnv)
    success('Created backend/.env with defaults')
    warn('Edit backend/.env with your GitHub OAuth credentials')
  }
} else {
  success('backend/.env already exists')
}

// ─── 6. Check PostgreSQL ─────────────────────────────────────
log('Checking PostgreSQL...')
if (run('pg_isready')) {
  success('PostgreSQL is running')
  log('Pushing database schema...')
  if (run('npx prisma db push', backendDir)) {
    success('Database schema pushed')
  } else {
    warn('Could not push schema — check DATABASE_URL in .env')
  }
} else {
  warn('PostgreSQL not detected — backend will work but without persistence')
  warn('Install PostgreSQL: https://www.postgresql.org/download/')
}

// ─── 7. Check Redis ─────────────────────────────────────────
log('Checking Redis...')
if (run('redis-cli ping')) {
  success('Redis is running')
} else {
  warn('Redis not detected — backend will use in-memory cache fallback')
}

// ─── 8. Install docs dependencies ────────────────────────────
log('Installing docs dependencies...')
const docsDir = resolve(ROOT, 'docs')
if (existsSync(resolve(docsDir, 'package.json'))) {
  runVisible('npm install', docsDir)
  success('Docs dependencies installed')
} else {
  warn('docs/package.json not found — skipping')
}

// ─── Done ────────────────────────────────────────────────────
console.log('')
console.log('  ─────────────────────────────────────────')
console.log('  🏙️  GitCity is ready!')
console.log('')
console.log('  Start development:')
console.log('    cd backend  && npm run dev   # API on :5000')
console.log('    cd frontend && npm run dev   # App on :5173')
console.log('')
console.log('  Documentation:')
console.log('    cd docs && npm run dev        # Docs on :5173')
console.log('')
