import { Router } from 'express'
import { fetchUserData } from '../services/github.service.js'
import { computeMetrics } from '../services/metrics.service.js'
import { cacheGet, cacheSet } from '../cache/redis.client.js'
import { authOptional } from '../middleware/auth.middleware.js'
import prisma from '../db/prisma.js'

const router = Router()

/**
 * GET /api/leaderboard
 * Returns developer leaderboard rankings.
 *
 * Query params:
 *   ?category=commits|stars|repos|activity  — ranking category
 *   ?period=daily|weekly|monthly|all-time   — time period
 *   ?limit=50                                — number of entries
 *   ?language=Rust                           — filter by language
 */
router.get('/', authOptional, async (req, res, next) => {
  try {
    const {
      category = 'activity',
      period = 'all-time',
      limit = 50,
      language,
    } = req.query

    const limitNum = Math.min(100, Math.max(10, Number(limit)))
    const validCategories = ['commits', 'stars', 'repos', 'activity', 'followers']
    const cat = validCategories.includes(category) ? category : 'activity'

    const cacheKey = `leaderboard:${cat}:${period}:${language || 'all'}:${limitNum}`
    const cached = await cacheGet(cacheKey)
    if (cached) return res.json(cached)

    // Curated developer pool for leaderboard
    const leaderboardPool = [
      'torvalds', 'gaearon', 'sindresorhus', 'tj', 'yyx990803',
      'getify', 'addyosmani', 'ThePrimeagen', 'kentcdodds', 'swyx',
      'trekhleb', 'bradtraversy', 'fireship-io', 'benawad', 'antfu',
      'egoist', 'pacocoursey', 'rauchg', 'leerob', 'dtolnay',
      'BurntSushi', 'Rich-Harris', 'tannerlinsley', 'karpathy', 'sharkdp',
      'junegunn', 'jesseduffield', 'charmbracelet', 'tiangolo', 'astral-sh',
    ]

    const entries = []
    for (const username of leaderboardPool) {
      try {
        const userData = await fetchUserData(username)
        const metrics = computeMetrics(userData)

        if (language && userData.topLanguage?.toLowerCase() !== language.toLowerCase()) {
          continue
        }

        entries.push({
          username: userData.username,
          displayName: userData.displayName || userData.username,
          avatarUrl: userData.avatarUrl,
          topLanguage: userData.topLanguage || 'Unknown',
          commits: metrics.commits,
          repos: metrics.repos,
          stars: metrics.stars,
          followers: userData.followers || 0,
          activityScore: metrics.activityScore,
          recentActivity: userData.recentActivity || false,
        })
      } catch {
        // Skip failed fetches
      }
    }

    // Sort by chosen category
    const scoreKey = cat === 'activity' ? 'activityScore' : cat
    entries.sort((a, b) => (b[scoreKey] || 0) - (a[scoreKey] || 0))

    // Assign ranks + trim
    const ranked = entries.slice(0, limitNum).map((entry, idx) => ({
      rank: idx + 1,
      ...entry,
      score: entry[scoreKey] || 0,
    }))

    // Store snapshot in DB (best-effort)
    try {
      const snapshotData = ranked.slice(0, 10).map(r => ({
        category: cat,
        username: r.username,
        score: r.score,
        rank: r.rank,
        period,
        metadata: { avatarUrl: r.avatarUrl, topLanguage: r.topLanguage },
      }))
      if (snapshotData.length > 0) {
        await prisma.leaderboardSnapshot.createMany({ data: snapshotData }).catch(() => {})
      }
    } catch {
      // Non-critical
    }

    const response = {
      leaderboard: ranked,
      category: cat,
      period,
      language: language || 'all',
      total: ranked.length,
      timestamp: new Date().toISOString(),
    }

    await cacheSet(cacheKey, response, 1800) // 30 min cache
    res.json(response)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/leaderboard/history
 * Returns leaderboard history snapshots for trend analysis.
 */
router.get('/history', async (req, res, next) => {
  try {
    const { category = 'activity', username, limit = 30 } = req.query

    const where = { category }
    if (username) where.username = username

    const snapshots = await prisma.leaderboardSnapshot.findMany({
      where,
      orderBy: { takenAt: 'desc' },
      take: Math.min(100, Number(limit)),
    }).catch(() => [])

    res.json({ snapshots })
  } catch (err) {
    next(err)
  }
})

export default router
