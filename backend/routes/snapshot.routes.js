import { Router } from 'express'
import { authOptional } from '../middleware/auth.middleware.js'
import {
  getSnapshotsForUser,
  getLatestSnapshot,
  getSnapshotDelta,
  aggregateSnapshots,
  getSnapshotStats,
} from '../services/snapshotEngine.js'
import { cacheGet, cacheSet } from '../cache/redis.client.js'
import prisma from '../db/prisma.js'

const router = Router()

/**
 * GET /api/snapshots/engine/status
 *
 * Snapshot engine health and statistics.
 */
router.get('/engine/status', async (_req, res) => {
  try {
    const engineStats = getSnapshotStats()

    // Count total snapshots in DB
    const totalInDb = await prisma.developerSnapshot.count().catch(() => 0)
    const hourlyCount = await prisma.developerSnapshot.count({
      where: { granularity: 'hourly' },
    }).catch(() => 0)
    const dailyCount = await prisma.developerSnapshot.count({
      where: { granularity: 'daily' },
    }).catch(() => 0)

    // Unique users with snapshots
    const uniqueUsers = await prisma.developerSnapshot.findMany({
      distinct: ['username'],
      select: { username: true },
    }).catch(() => [])

    res.json({
      status: 'ok',
      engine: engineStats,
      database: {
        totalSnapshots: totalInDb,
        hourlySnapshots: hourlyCount,
        dailySnapshots: dailyCount,
        uniqueUsers: uniqueUsers.length,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/snapshots/:username
 *
 * Get time-series snapshots for a user.
 * Returns real recorded data from the DeveloperSnapshot table.
 *
 * Query:
 *   ?from=2024-01-01&to=2025-01-01 — date range
 *   ?granularity=daily|hourly|any   — snapshot granularity
 *   ?points=24                      — number of evenly-spaced output points
 *   ?limit=500                      — max raw snapshots
 */
router.get('/:username', authOptional, async (req, res, next) => {
  try {
    const { username } = req.params
    const {
      from: fromStr,
      to: toStr,
      granularity = 'daily',
      points,
      limit = 500,
    } = req.query

    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 365 * 86400000) // default: 1 year
    const to = toStr ? new Date(toStr) : new Date()

    // If points requested, use aggregation (evenly-spaced interpolation)
    if (points) {
      const numPoints = Math.min(100, Math.max(2, Number(points)))
      const timeline = await aggregateSnapshots(username, from, to, numPoints)

      return res.json({
        username,
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        points: timeline.length,
        requestedPoints: numPoints,
        timeline,
        timestamp: new Date().toISOString(),
      })
    }

    // Raw snapshots
    const snapshots = await getSnapshotsForUser(
      username, from, to, granularity, Math.min(Number(limit), 1000)
    )

    res.json({
      username,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      granularity,
      count: snapshots.length,
      snapshots,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/snapshots/:username/latest
 *
 * Get the most recent snapshot for a user.
 */
router.get('/:username/latest', authOptional, async (req, res, next) => {
  try {
    const { username } = req.params
    const snapshot = await getLatestSnapshot(username)

    if (!snapshot) {
      return res.status(404).json({
        error: 'No snapshots found',
        username,
        hint: 'Snapshots are created when users register via OAuth and the snapshot engine runs.',
      })
    }

    res.json({
      username,
      snapshot,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/snapshots/:username/delta
 *
 * Get the change in metrics over a period.
 * Shows growth: what changed between the oldest and newest snapshots in the range.
 *
 * Query: ?period=30 (days)
 */
router.get('/:username/delta', authOptional, async (req, res, next) => {
  try {
    const { username } = req.params
    const { period = 30 } = req.query

    const delta = await getSnapshotDelta(username, Number(period))

    if (!delta) {
      return res.status(404).json({
        error: 'No snapshot data available for delta computation',
        username,
      })
    }

    res.json({
      username,
      ...delta,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

export default router
