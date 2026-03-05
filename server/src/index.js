import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import userRoute from './routes/user.js'
import cityRoute from './routes/city.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// CORS — allow frontend dev server
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET'],
}))

app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/user', userRoute)
app.use('/api/city', cityRoute)

// Global error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  })
})

app.listen(PORT, () => {
  console.log(`🏙️  GitCity API running on http://localhost:${PORT}`)
  console.log(`   GitHub Token: ${process.env.GITHUB_TOKEN ? '✓ loaded' : '✗ not set (60 req/hr limit)'}`)
})
