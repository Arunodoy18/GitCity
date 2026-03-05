import { Router } from 'express'
import { fetchUserData, getRateLimit } from '../services/github.service.js'
import { computeMetrics, getOrComputeMetrics } from '../services/metrics.service.js'
import { authOptional } from '../middleware/auth.middleware.js'
import prisma from '../db/prisma.js'

const router = Router()

/**
 * GET /api/user/:username
 * Fetch a GitHub user's city data (profile + metrics).
 * Uses authenticated user's token for higher rate limits if logged in.
 */
router.get('/:username', authOptional, async (req, res, next) => {
  try {
    const { username } = req.params

    if (!username || username.length < 1 || username.length > 39) {
      return res.status(400).json({ error: 'Invalid username' })
    }

    // Use the logged-in user's access token for higher GitHub rate limits
    let accessToken = null
    if (req.user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { accessToken: true },
      })
      accessToken = dbUser?.accessToken || null
    }

    // Fetch from GitHub (with Redis caching)
    const userData = await fetchUserData(username, accessToken)

    // Compute metrics
    const metrics = computeMetrics(userData)

    // If the searched user exists in our DB, store metrics
    const existingUser = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    }).catch(() => null)

    if (existingUser) {
      await getOrComputeMetrics(existingUser.id, userData).catch(() => {})
    }

    res.json({
      ...userData,
      metrics,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/user
 * Shows rate limit info
 */
router.get('/', authOptional, async (req, res, next) => {
  try {
    let accessToken = null
    if (req.user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { accessToken: true },
      })
      accessToken = dbUser?.accessToken || null
    }
    const rateLimit = await getRateLimit(accessToken)
    res.json({ info: 'GitCity User API', rateLimit })
  } catch (err) {
    next(err)
  }
})

export default router
