#!/usr/bin/env node

/**
 * GitCity Dev Script — Start all services concurrently
 *
 * Usage: node scripts/dev.js
 */

import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const processes = []

function startService(name, cmd, args, cwd, color) {
  const colorCode = { cyan: '36', green: '32', yellow: '33', magenta: '35' }[color] || '37'

  const proc = spawn(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  })

  const prefix = `\x1b[${colorCode}m[${name}]\x1b[0m`

  proc.stdout.on('data', (data) => {
    data.toString().split('\n').filter(Boolean).forEach(line => {
      console.log(`${prefix} ${line}`)
    })
  })

  proc.stderr.on('data', (data) => {
    data.toString().split('\n').filter(Boolean).forEach(line => {
      console.log(`${prefix} ${line}`)
    })
  })

  proc.on('close', (code) => {
    console.log(`${prefix} exited with code ${code}`)
  })

  processes.push(proc)
  return proc
}

console.log('')
console.log('  🏙️  GitCity Dev Mode')
console.log('  ────────────────────')
console.log('')

// Start backend
startService('backend', 'node', ['--watch', 'server.js'], resolve(ROOT, 'backend'), 'cyan')

// Start frontend
startService('frontend', 'npx', ['vite', '--host'], resolve(ROOT, 'frontend'), 'green')

console.log('  Backend:  http://localhost:5000')
console.log('  Frontend: http://localhost:5173')
console.log('')
console.log('  Press Ctrl+C to stop all services')
console.log('')

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n  Stopping all services...')
  processes.forEach(p => p.kill('SIGTERM'))
  setTimeout(() => process.exit(0), 1000)
})
