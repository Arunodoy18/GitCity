import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'

// Load environment before anything else
dotenv.config()

// Routes
import authRoutes from './routes/auth.routes.js'
import userRoutes from './routes/user.routes.js'
import cityRoutes from './routes/city.routes.js'
import trendingRoutes from './routes/trending.routes.js'
import metricsRoutes from './routes/metrics.routes.js'
import globalRoutes from './routes/global.routes.js'
import teamRoutes from './routes/team.routes.js'
import timelineRoutes from './routes/timeline.routes.js'
import leaderboardRoutes from './routes/leaderboard.routes.js'
import embedRoutes from './routes/embed.routes.js'
import webhookRoutes from './routes/webhook.routes.js'
import spatialRoutes from './routes/spatial.routes.js'
import snapshotRoutes from './routes/snapshot.routes.js'

// Services
import { attachWebSocket, getLiveStats } from './services/live.service.js'
import { startEventProcessor, getProcessorStats } from './services/eventProcessor.js'
import { startSnapshotEngine, getSnapshotStats } from './services/snapshotEngine.js'

// Background jobs
import { startMetricsJob } from './jobs/metrics.job.js'

const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 5000
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// ─── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    const allowed = [
      FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000',
    ]
    if (allowed.includes(origin) || origin.endsWith('.netlify.app')) {
      return callback(null, true)
    }
    callback(new Error('Not allowed by CORS'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,  // allow cookies for auth
}))

app.use(express.json({ limit: '5mb' }))

// ─── Health Check ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'gitcity-backend',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    pipeline: getProcessorStats(),
    snapshots: getSnapshotStats(),
  })
})

// ─── Routes ─────────────────────────────────────────────────
app.use('/auth', authRoutes)              // OAuth: /auth/github, /auth/github/callback, /auth/me, /auth/logout
app.use('/api/user', userRoutes)          // Users: /api/user/:username
app.use('/api/city', cityRoutes)          // City:  /api/city, /api/city/save, /api/city/multi
app.use('/api/trending', trendingRoutes)  // Trending: /api/trending
app.use('/api/metrics', metricsRoutes)    // Metrics: /api/metrics/:username
app.use('/api/global', globalRoutes)      // Global City: /api/global, /api/global/stats
app.use('/api/teams', teamRoutes)         // Teams: /api/teams, /api/teams/:slug
app.use('/api/timeline', timelineRoutes)  // Time-Travel: /api/timeline/:username
app.use('/api/leaderboard', leaderboardRoutes) // Leaderboard: /api/leaderboard
app.use('/api/embed', embedRoutes)        // Portfolio Embed: /api/embed/:username
app.use('/api/webhooks', webhookRoutes)   // Webhook Pipeline: /api/webhooks/github
app.use('/api/spatial', spatialRoutes)    // Spatial Engine: /api/spatial/topology, /api/spatial/districts
app.use('/api/snapshots', snapshotRoutes) // Snapshot Engine: /api/snapshots/:username

// ─── 404 Handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path })
})

// ─── Error Handler ──────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${err.message}`)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  })
})

// ─── Start Server ───────────────────────────────────────────
// Attach WebSocket for live commit mode
attachWebSocket(server)

server.listen(PORT, () => {
  console.log(`\n🏙️  GitCity SaaS Backend`)
  console.log(`   Port:     http://localhost:${PORT}`)
  console.log(`   Frontend: ${FRONTEND_URL}`)
  console.log(`   WebSocket: ws://localhost:${PORT}/ws/live`)
  console.log(`   GitHub:   ${process.env.GITHUB_CLIENT_ID ? '✓ OAuth configured' : '✗ No OAuth'}`)
  console.log(`   Database: ${process.env.DATABASE_URL ? '✓ configured' : '✗ not configured'}`)
  console.log(`   Redis:    ${process.env.REDIS_URL ? '✓ configured' : '⚡ in-memory cache (no REDIS_URL)'}`)
  console.log(`   Webhook:  ${process.env.GITHUB_WEBHOOK_SECRET ? '✓ secret configured' : '⚠ dev mode (no signature verification)'}`)
  console.log(`   Pipeline: ✓ Real-time event processor`)
  console.log(`   Spatial:  ✓ Multi-dimensional district engine`)
  console.log(`   Snapshots: ✓ Time-series snapshot engine`)
  console.log('')
})

// ─── Background Jobs ────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  startMetricsJob()

  // Upgrade 1: Start real-time event pipeline
  startEventProcessor().catch(err => {
    console.error('[Server] Event processor startup failed:', err.message)
  })

  // Upgrade 3: Start snapshot engine (daily snapshots + cleanup)
  startSnapshotEngine()
}
