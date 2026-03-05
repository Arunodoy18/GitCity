import { Router } from 'express'
import { authRequired, authOptional } from '../middleware/auth.middleware.js'
import { fetchUserData, fetchUserRepos } from '../services/github.service.js'
import { getOrComputeMetrics, getLatestMetrics } from '../services/metrics.service.js'
import prisma from '../db/prisma.js'

const router = Router()

/**
 * GET /api/city
 * Returns the authenticated user's city data (their personal city).
 * Includes metrics history and city snapshot if saved.
 */
router.get('/', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.id

    // Get user from DB with their access token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        accessToken: true,
      },
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Fetch fresh GitHub data using user's own token
    const userData = await fetchUserData(user.username, user.accessToken)

    // Compute and store metrics
    const metrics = await getOrComputeMetrics(user.id, userData)

    // Get latest city snapshot (if any)
    const latestCity = await prisma.city.findFirst({
      where: { userId: user.id },
      orderBy: { generatedAt: 'desc' },
    })

    // Fetch repos for building variety
    const repos = await fetchUserRepos(user.username, user.accessToken)

    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      github: userData,
      metrics,
      repos,
      city: latestCity?.citySnapshot || null,
      generatedAt: latestCity?.generatedAt || null,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/city/save
 * Save the current city layout snapshot for the authenticated user.
 */
router.post('/save', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { citySnapshot, metricsData } = req.body

    if (!citySnapshot) {
      return res.status(400).json({ error: 'citySnapshot is required' })
    }

    const city = await prisma.city.create({
      data: {
        userId,
        citySnapshot,
        metricsData: metricsData || null,
      },
    })

    res.json({
      id: city.id,
      generatedAt: city.generatedAt,
      message: 'City snapshot saved',
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/city/history
 * Get city snapshot history for the authenticated user.
 */
router.get('/history', authRequired, async (req, res, next) => {
  try {
    const cities = await prisma.city.findMany({
      where: { userId: req.user.id },
      orderBy: { generatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        generatedAt: true,
        metricsData: true,
      },
    })

    res.json({ cities })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/city/multi
 * Fetch multiple users for a multi-user city view.
 * Query: ?users=user1,user2,...
 */
router.get('/multi', authOptional, async (req, res, next) => {
  try {
    const usersParam = req.query.users
    if (!usersParam) {
      return res.status(400).json({ error: 'Provide ?users=user1,user2,...' })
    }

    const usernames = usersParam
      .split(',')
      .map(u => u.trim())
      .filter(u => u.length > 0)
      .slice(0, 20)

    // Get access token for higher rate limits if authenticated
    let accessToken = null
    if (req.user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { accessToken: true },
      })
      accessToken = dbUser?.accessToken || null
    }

    const results = await Promise.allSettled(
      usernames.map(username => fetchUserData(username, accessToken))
    )

    const users = []
    const errors = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        users.push(result.value)
      } else {
        errors.push({
          username: usernames[index],
          error: result.reason.message,
        })
      }
    })

    res.json({ users, errors, total: users.length })
  } catch (err) {
    next(err)
  }
})

export default router
