import { Router } from 'express'
import { fetchUserData, fetchUserRepos } from '../services/github.service.js'
import { computeMetrics } from '../services/metrics.service.js'
import { cacheGet, cacheSet } from '../cache/redis.client.js'

const router = Router()

/**
 * GET /api/embed/:username
 * Returns minimal city data optimized for iframe/embed rendering.
 * No auth required — public endpoint for portfolio embeds.
 *
 * Query: ?theme=dark|light&animate=true&showLabels=true
 */
router.get('/:username', async (req, res, next) => {
  try {
    const { username } = req.params
    const {
      theme = 'dark',
      animate = 'true',
      showLabels = 'true',
    } = req.query

    if (!username || username.length < 1 || username.length > 39) {
      return res.status(400).json({ error: 'Invalid username' })
    }

    const cacheKey = `embed:${username.toLowerCase()}`
    const cached = await cacheGet(cacheKey)
    if (cached) return res.json({ ...cached, theme, animate: animate === 'true', showLabels: showLabels === 'true' })

    const userData = await fetchUserData(username)
    const metrics = computeMetrics(userData)
    const repos = await fetchUserRepos(username)

    // Build per-repo building data for the embed
    const buildings = repos.slice(0, 50).map((repo, i) => ({
      name: repo.name,
      language: repo.language || 'Unknown',
      stars: repo.stars,
      forks: repo.forks,
      height: Math.max(1, Math.min(40, (repo.stars + 1) * 2 + Math.log2(repo.forks + 1) * 3)),
      width: Math.max(1, Math.min(6, Math.log2(repo.stars + 2) * 1.5)),
      active: !repo.isForked,
      updatedAt: repo.updatedAt,
    }))

    const response = {
      username: userData.username,
      displayName: userData.displayName || userData.username,
      avatarUrl: userData.avatarUrl,
      bio: userData.bio,
      profileUrl: userData.profileUrl,
      metrics: {
        commits: metrics.commits,
        repos: metrics.repos,
        stars: metrics.stars,
        followers: userData.followers || 0,
        activityScore: metrics.activityScore,
        topLanguage: userData.topLanguage || 'Unknown',
      },
      buildings,
      totalBuildings: buildings.length,
      timestamp: new Date().toISOString(),
    }

    await cacheSet(cacheKey, response, 1800) // 30 min cache

    // Add embed-specific options
    res.json({
      ...response,
      theme,
      animate: animate === 'true',
      showLabels: showLabels === 'true',
    })
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: 'GitHub user not found' })
    }
    next(err)
  }
})

export default router
