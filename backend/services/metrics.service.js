import { cacheGet, cacheSet } from '../cache/redis.client.js'
import prisma from '../db/prisma.js'

const METRICS_CACHE_TTL = 300 // 5 min

/**
 * Metrics Engine — Converts GitHub activity into GitCity building metrics.
 *
 * Metrics computed:
 *   commitScore:    weighted commit count → building height
 *   repoCount:      number of repos → building width
 *   starScore:      total stars → building glow intensity
 *   activityScore:  composite score → overall building prominence
 *
 * Formula:
 *   activityScore = commits * 0.5 + repos * 0.3 + stars * 0.2
 */

/**
 * Compute metrics from raw GitHub user data
 * @param {Object} userData — output from github.service.fetchUserData
 * @returns {Object} computed metrics
 */
export function computeMetrics(userData) {
  const commits = userData.commits || 0
  const repos = userData.repos || 0
  const stars = userData.totalStars || 0
  const followers = userData.followers || 0

  // Normalized scores (log scale for large values)
  const commitScore = Math.min(100, Math.log2(commits + 1) * 8)
  const repoScore = Math.min(100, Math.log2(repos + 1) * 12)
  const starScore = Math.min(100, Math.log2(stars + 1) * 10)
  const followerScore = Math.min(100, Math.log2(followers + 1) * 8)

  // Composite activity score
  const activityScore =
    commits * 0.5 +
    repos * 0.3 +
    stars * 0.2

  return {
    commits,
    repos,
    stars,
    followers,
    commitScore: Math.round(commitScore * 100) / 100,
    repoScore: Math.round(repoScore * 100) / 100,
    starScore: Math.round(starScore * 100) / 100,
    followerScore: Math.round(followerScore * 100) / 100,
    activityScore: Math.round(activityScore * 100) / 100,
    topLanguage: userData.topLanguage || 'Unknown',
    recentActivity: userData.recentActivity || false,
  }
}

/**
 * Get or compute metrics for a user. Checks cache → DB → computes fresh.
 *
 * @param {number} userId — database user ID
 * @param {Object} userData — raw GitHub data
 * @returns {Object} metrics
 */
export async function getOrComputeMetrics(userId, userData) {
  const cacheKey = `metrics:user:${userData.username.toLowerCase()}`

  // 1. Check cache
  const cached = await cacheGet(cacheKey)
  if (cached) return cached

  // 2. Compute fresh metrics
  const metrics = computeMetrics(userData)

  // 3. Store in database
  try {
    await prisma.metric.create({
      data: {
        userId,
        commits: metrics.commits,
        repos: metrics.repos,
        stars: metrics.stars,
        followers: metrics.followers,
        activityScore: metrics.activityScore,
        topLanguage: metrics.topLanguage,
        recentActivity: metrics.recentActivity,
      },
    })
  } catch (err) {
    console.warn(`[Metrics] DB write failed: ${err.message}`)
  }

  // 4. Cache
  await cacheSet(cacheKey, metrics, METRICS_CACHE_TTL)
  return metrics
}

/**
 * Get latest metrics for a user from DB (no computation)
 */
export async function getLatestMetrics(userId) {
  try {
    return await prisma.metric.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })
  } catch {
    return null
  }
}

/**
 * Batch compute and store metrics for multiple users
 */
export async function batchComputeMetrics(usersWithData) {
  const results = []
  for (const { userId, userData } of usersWithData) {
    const metrics = await getOrComputeMetrics(userId, userData)
    results.push({ userId, username: userData.username, metrics })
  }
  return results
}
