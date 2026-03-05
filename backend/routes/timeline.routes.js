import { Router } from 'express'
import { authOptional } from '../middleware/auth.middleware.js'
import { fetchUserData } from '../services/github.service.js'
import { computeMetrics } from '../services/metrics.service.js'
import { getSnapshotsForUser, aggregateSnapshots } from '../services/snapshotEngine.js'
import { cacheGet, cacheSet } from '../cache/redis.client.js'
import prisma from '../db/prisma.js'

const router = Router()

/**
 * GET /api/timeline/:username
 * Returns historical metrics snapshots for time-travel mode.
 *
 * Upgrade 3: Prefers real DeveloperSnapshot records from the Snapshot Engine.
 * Falls back to legacy Metric records + S-curve simulation for gaps.
 *
 * Priority order:
 *   1. DeveloperSnapshot table (real recorded data from Snapshot Engine)
 *   2. Metric table (legacy snapshots from metrics job)
 *   3. S-curve simulation (only for time periods before recording started)
 *
 * Query: ?from=2019&to=2025&points=12
 */
router.get('/:username', authOptional, async (req, res, next) => {
  try {
    const { username } = req.params
    const {
      from = 2019,
      to = new Date().getFullYear(),
      points = 12,
    } = req.query

    const fromYear = Math.max(2008, Number(from))
    const toYear = Math.min(new Date().getFullYear(), Number(to))
    const numPoints = Math.min(50, Math.max(2, Number(points)))

    const cacheKey = `timeline:${username}:${fromYear}:${toYear}:${numPoints}`
    const cached = await cacheGet(cacheKey)
    if (cached) return res.json(cached)

    // Fetch current data
    const userData = await fetchUserData(username)
    const currentMetrics = computeMetrics(userData)

    // ─── Phase 1: Try DeveloperSnapshot (real recorded data) ─
    const fromDate = new Date(fromYear, 0, 1)
    const toDate = new Date(toYear, 11, 31)

    let realSnapshots = []
    try {
      realSnapshots = await getSnapshotsForUser(username, fromDate, toDate, 'any', 500)
    } catch {
      // Snapshot engine not available — fallback gracefully
    }

    // ─── Phase 2: If enough real data, use aggregation ───────
    if (realSnapshots.length >= numPoints * 0.5) {
      // We have sufficient real data — use the snapshot aggregation engine
      const timeline = await aggregateSnapshots(username, fromDate, toDate, numPoints)

      const response = buildResponse(username, userData, currentMetrics, timeline, fromYear, toYear)
      await cacheSet(cacheKey, response, 3600)
      return res.json(response)
    }

    // ─── Phase 3: Hybrid — real snapshots + legacy DB + S-curve fill ──
    // Check DB for legacy historical snapshots
    let dbSnapshots = []
    try {
      const user = await prisma.user.findUnique({
        where: { username: username.toLowerCase() },
      })
      if (user) {
        dbSnapshots = await prisma.metric.findMany({
          where: { userId: user.id },
          orderBy: { updatedAt: 'asc' },
          take: 200,
        })
      }
    } catch {
      // Continue without DB data
    }

    // Merge real snapshots with legacy metrics into a combined timeline source
    const allRecordedData = [
      ...realSnapshots.map(s => ({
        date: new Date(s.snapshotDate),
        commits: s.commits,
        repos: s.repos,
        stars: s.stars,
        followers: s.followers,
        activityScore: s.activityScore,
        topLanguage: s.topLanguage || currentMetrics.topLanguage,
        source: 'snapshot',
      })),
      ...dbSnapshots.map(s => ({
        date: new Date(s.updatedAt),
        commits: s.commits,
        repos: s.repos,
        stars: s.stars,
        followers: s.followers || 0,
        activityScore: s.activityScore,
        topLanguage: s.topLanguage || currentMetrics.topLanguage,
        source: 'metric',
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime())

    // Generate timeline points
    const accountCreated = new Date(userData.createdAt || '2015-01-01')
    const accountYear = accountCreated.getFullYear()
    const effectiveFrom = Math.max(fromYear, accountYear)
    const yearSpan = toYear - effectiveFrom

    const timeline = []
    for (let i = 0; i < numPoints; i++) {
      const t = numPoints > 1 ? i / (numPoints - 1) : 1
      const year = effectiveFrom + Math.round(t * yearSpan)
      const month = Math.round(t * 11) + 1
      const targetDate = new Date(year, month - 1, 15)

      // Find the closest recorded data point
      const nearest = findNearestRecord(allRecordedData, targetDate, 45)

      if (nearest) {
        timeline.push({
          year,
          month,
          date: targetDate.toISOString().slice(0, 10),
          commits: nearest.commits,
          repos: nearest.repos,
          stars: nearest.stars,
          followers: nearest.followers,
          activityScore: nearest.activityScore,
          topLanguage: nearest.topLanguage,
          source: nearest.source === 'snapshot' ? 'recorded' : 'recorded-legacy',
        })
      } else {
        // S-curve simulation for periods without recorded data
        const progress = t
        const sCurve = 1 / (1 + Math.exp(-10 * (progress - 0.4)))
        const randomVariation = 1 + (Math.sin(progress * 17 + year * 0.3) * 0.15)

        const commits = Math.round(currentMetrics.commits * sCurve * randomVariation)
        const repos = Math.max(1, Math.round(currentMetrics.repos * sCurve * randomVariation))
        const stars = Math.round(currentMetrics.stars * sCurve * sCurve * randomVariation)
        const followers = Math.round(
          (userData.followers || 0) * Math.pow(sCurve, 1.5) * randomVariation
        )

        timeline.push({
          year,
          month,
          date: targetDate.toISOString().slice(0, 10),
          commits: Math.max(0, commits),
          repos: Math.max(0, repos),
          stars: Math.max(0, stars),
          followers: Math.max(0, followers),
          activityScore: Math.round(commits * 0.5 + repos * 0.3 + stars * 0.2),
          topLanguage: currentMetrics.topLanguage,
          source: 'estimated',
        })
      }
    }

    const response = buildResponse(username, userData, currentMetrics, timeline, effectiveFrom, toYear)
    await cacheSet(cacheKey, response, 3600)
    res.json(response)
  } catch (err) {
    next(err)
  }
})

/**
 * Find the nearest recorded data point within maxDays of the target date.
 */
function findNearestRecord(records, targetDate, maxDays) {
  const targetTime = targetDate.getTime()
  const maxMs = maxDays * 86400000

  let nearest = null
  let nearestDist = Infinity

  for (const record of records) {
    const dist = Math.abs(record.date.getTime() - targetTime)
    if (dist < nearestDist && dist < maxMs) {
      nearest = record
      nearestDist = dist
    }
  }

  return nearest
}

/**
 * Build standardized timeline API response.
 */
function buildResponse(username, userData, currentMetrics, timeline, fromYear, toYear) {
  // Compute data quality metrics
  const recorded = timeline.filter(p => p.source === 'recorded' || p.source === 'recorded-legacy').length
  const estimated = timeline.filter(p => p.source === 'estimated').length
  const interpolated = timeline.filter(p => p.source === 'interpolated').length

  return {
    username: userData.username,
    displayName: userData.displayName || userData.username,
    avatarUrl: userData.avatarUrl,
    accountCreated: new Date(userData.createdAt || '2015-01-01').toISOString().slice(0, 10),
    current: {
      commits: currentMetrics.commits,
      repos: currentMetrics.repos,
      stars: currentMetrics.stars,
      followers: userData.followers || 0,
      activityScore: currentMetrics.activityScore,
    },
    timeline,
    fromYear,
    toYear,
    points: timeline.length,
    dataQuality: {
      recorded,
      estimated,
      interpolated,
      total: timeline.length,
      realDataRatio: timeline.length > 0 ? Math.round((recorded / timeline.length) * 100) : 0,
    },
    timestamp: new Date().toISOString(),
  }
}

export default router
