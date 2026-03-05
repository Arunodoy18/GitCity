import { Router } from 'express'
import { fetchUserData } from '../services/github.service.js'
import { computeMetrics } from '../services/metrics.service.js'
import { cacheGet, cacheSet } from '../cache/redis.client.js'
import { authOptional } from '../middleware/auth.middleware.js'
import prisma from '../db/prisma.js'

const router = Router()

/**
 * GET /api/trending
 * Returns trending GitHub users with city metrics.
 * Cached for 30 minutes.
 */
router.get('/', authOptional, async (req, res, next) => {
  try {
    const { language, since = 'daily', limit = 20 } = req.query
    const cacheKey = `trending:${language || 'all'}:${since}:${limit}`

    // Check cache
    const cached = await cacheGet(cacheKey)
    if (cached) return res.json(cached)

    // Curated list of active GitHub users (fallback when trending API is unavailable)
    const trendingUsernames = [
      'torvalds', 'gaearon', 'sindresorhus', 'tj', 'yyx990803',
      'getify', 'addyosmani', 'ThePrimeagen', 'kentcdodds', 'swyx',
      'trekhleb', 'bradtraversy', 'fireship-io', 'benawad', 'denoland',
      'antfu', 'egoist', 'pacocoursey', 'rauchg', 'leerob',
    ]

    const selected = trendingUsernames.slice(0, Math.min(Number(limit), 50))

    // Fetch data for each (with GitHub token if logged in)
    let accessToken = null
    if (req.user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { accessToken: true },
      }).catch(() => null)
      accessToken = dbUser?.accessToken || null
    }

    const results = []
    for (const username of selected) {
      try {
        const userData = await fetchUserData(username, accessToken)
        const metrics = computeMetrics(userData)
        results.push({
          username: userData.username,
          displayName: userData.displayName || userData.username,
          avatarUrl: userData.avatarUrl,
          bio: userData.bio,
          language: userData.topLanguage || null,
          metrics: {
            commits: metrics.commits,
            repos: metrics.repos,
            stars: metrics.stars,
            activityScore: metrics.activityScore,
          },
        })
      } catch {
        // Skip users that fail to fetch
      }
    }

    // Sort by activity score descending
    results.sort((a, b) => (b.metrics.activityScore || 0) - (a.metrics.activityScore || 0))

    const response = {
      trending: results,
      since,
      language: language || 'all',
      count: results.length,
      timestamp: new Date().toISOString(),
    }

    // Cache for 30 minutes
    await cacheSet(cacheKey, response, 1800)

    res.json(response)
  } catch (err) {
    next(err)
  }
})

export default router
