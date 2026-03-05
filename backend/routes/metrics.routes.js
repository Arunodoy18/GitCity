import { Router } from 'express'
import { fetchUserData } from '../services/github.service.js'
import { computeMetrics, getOrComputeMetrics, getLatestMetrics } from '../services/metrics.service.js'
import { authOptional } from '../middleware/auth.middleware.js'
import prisma from '../db/prisma.js'

const router = Router()

/**
 * GET /api/metrics/:username
 * Returns detailed metrics for a GitHub user's city.
 */
router.get('/:username', authOptional, async (req, res, next) => {
  try {
    const { username } = req.params

    if (!username || username.length < 1 || username.length > 39) {
      return res.status(400).json({ error: 'Invalid username' })
    }

    // Use authenticated user's token for higher rate limits
    let accessToken = null
    if (req.user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { accessToken: true },
      }).catch(() => null)
      accessToken = dbUser?.accessToken || null
    }

    // Fetch GitHub data
    const userData = await fetchUserData(username, accessToken)

    // Compute metrics
    const metrics = computeMetrics(userData)

    // Check if user exists in DB for historical metrics
    const existingUser = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    }).catch(() => null)

    let storedMetrics = null
    let history = []

    if (existingUser) {
      storedMetrics = await getLatestMetrics(existingUser.id)
      // Also store current metrics
      await getOrComputeMetrics(existingUser.id, userData).catch(() => {})

      // Get metrics history (last 30 entries)
      history = await prisma.metric.findMany({
        where: { userId: existingUser.id },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        select: {
          commits: true,
          repos: true,
          stars: true,
          followers: true,
          activityScore: true,
          topLanguage: true,
          recentActivity: true,
          updatedAt: true,
        },
      }).catch(() => [])
    }

    res.json({
      username: userData.username,
      displayName: userData.displayName || userData.username,
      avatarUrl: userData.avatarUrl,
      metrics: {
        ...metrics,
        totalStars: userData.totalStars || 0,
        totalForks: userData.totalForks || 0,
        topLanguage: userData.topLanguage || null,
        recentActivity: userData.recentActivity || false,
        estimatedTotalCommits: userData.estimatedTotalCommits || 0,
      },
      building: {
        height: Math.max(1, Math.min(60, (metrics.commits || 0) / 50)),
        width: Math.max(1, Math.min(8, (metrics.repos || 0) * 0.5)),
        glowIntensity: userData.recentActivity ? 0.8 : 0,
      },
      history,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

export default router
