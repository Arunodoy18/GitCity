import cron from 'node-cron'
import prisma from '../db/prisma.js'
import { fetchUserData } from './github.service.js'
import { computeMetrics } from './metrics.service.js'
import { cacheGet, cacheSet } from '../cache/redis.client.js'

/**
 * GitCity City Snapshot Engine — Time-Series Data Store
 *
 * Architecture:
 *   Cron Job → Fetch User Data → Compute Metrics → Store Immutable Snapshot → DB
 *
 * This replaces the S-curve simulation in timeline.routes.js with REAL recorded data.
 * Every snapshot is immutable — you never overwrite, only append.
 *
 * Granularity:
 *   - hourly:  Stored every hour during active event periods (triggered by event processor)
 *   - daily:   Stored once per day by the scheduled cron job
 *   - weekly:  Aggregated from dailies (computed on read, not stored separately)
 *
 * Storage model (DeveloperSnapshot):
 *   userId, username, commits, repos, stars, followers, activityScore,
 *   topLanguage, recentActivity, buildingHeight, buildingGlow,
 *   languageBreakdown (JSON), snapshotDate, granularity
 *
 * Time-series queries:
 *   - getSnapshotsForUser(username, from, to, granularity)
 *   - getLatestSnapshot(username)
 *   - getSnapshotDelta(username, periodDays)
 *   - aggregateSnapshots(username, from, to, intervalDays)
 *
 * Cleanup:
 *   - Hourly snapshots older than 7 days → deleted
 *   - Daily snapshots kept for 2 years
 */

const SNAPSHOT_RETENTION = {
  hourly: 7 * 24 * 60 * 60 * 1000,   // 7 days
  daily: 730 * 24 * 60 * 60 * 1000,  // ~2 years
}

let isRunning = false
let dailyCronJob = null
let cleanupCronJob = null
let stats = {
  totalSnapshots: 0,
  lastRunAt: null,
  lastRunDuration: 0,
  usersProcessed: 0,
  errors: 0,
}

// ─── Snapshot Creation ──────────────────────────────────────

/**
 * Create a snapshot for a single user. Stores raw data as an immutable record.
 *
 * @param {number} userId — database user ID
 * @param {Object} userData — raw GitHub data from github.service
 * @param {string} granularity — 'hourly' | 'daily'
 * @returns {Object} created snapshot
 */
export async function createSnapshot(userId, userData, granularity = 'daily') {
  const metrics = computeMetrics(userData)

  // Compute building dimensions for 3D rendering
  const buildingHeight = Math.min(3.0, Math.max(0.3,
    Math.log2((metrics.commits || 0) + 1) * 0.15 +
    Math.log2((metrics.stars || 0) + 1) * 0.05
  ))
  const buildingGlow = Math.min(1.0,
    Math.log2((metrics.stars || 0) + 1) / 15 +
    (metrics.recentActivity ? 0.3 : 0)
  )

  // Language breakdown from repos
  const languageBreakdown = {}
  if (userData.topRepos) {
    for (const repo of userData.topRepos) {
      if (repo.language) {
        languageBreakdown[repo.language] = (languageBreakdown[repo.language] || 0) + 1
      }
    }
  }

  // Snap to the appropriate time boundary
  const now = new Date()
  const snapshotDate = granularity === 'hourly'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)

  try {
    const snapshot = await prisma.developerSnapshot.upsert({
      where: {
        userId_snapshotDate_granularity: {
          userId,
          snapshotDate,
          granularity,
        },
      },
      create: {
        userId,
        username: userData.username.toLowerCase(),
        commits: metrics.commits,
        repos: metrics.repos,
        stars: metrics.stars,
        followers: metrics.followers,
        activityScore: metrics.activityScore,
        topLanguage: metrics.topLanguage,
        recentActivity: metrics.recentActivity,
        buildingHeight,
        buildingGlow,
        languageBreakdown: Object.keys(languageBreakdown).length > 0 ? languageBreakdown : null,
        snapshotDate,
        granularity,
      },
      update: {
        commits: metrics.commits,
        repos: metrics.repos,
        stars: metrics.stars,
        followers: metrics.followers,
        activityScore: metrics.activityScore,
        topLanguage: metrics.topLanguage,
        recentActivity: metrics.recentActivity,
        buildingHeight,
        buildingGlow,
        languageBreakdown: Object.keys(languageBreakdown).length > 0 ? languageBreakdown : null,
      },
    })

    stats.totalSnapshots++
    return snapshot
  } catch (err) {
    stats.errors++
    console.warn(`[SnapshotEngine] Failed to create snapshot for user ${userId}: ${err.message}`)
    return null
  }
}

/**
 * Create an hourly snapshot for a user. Called by the Event Processor
 * when a high-impact event is processed.
 *
 * @param {string} username
 */
export async function createHourlySnapshot(username) {
  try {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true, accessToken: true },
    })

    if (!user) return null

    const token = user.accessToken || null
    const userData = await fetchUserData(username, token)
    return await createSnapshot(user.id, userData, 'hourly')
  } catch (err) {
    console.warn(`[SnapshotEngine] Hourly snapshot failed for ${username}: ${err.message}`)
    return null
  }
}

// ─── Time-Series Queries ────────────────────────────────────

/**
 * Get snapshots for a user within a date range.
 *
 * @param {string} username
 * @param {Date} from — start date
 * @param {Date} to — end date
 * @param {string} granularity — 'hourly' | 'daily' | 'any'
 * @param {number} limit — max snapshots to return
 * @returns {Array} snapshots
 */
export async function getSnapshotsForUser(username, from, to, granularity = 'daily', limit = 500) {
  const cacheKey = `snapshots:${username}:${from?.toISOString()}:${to?.toISOString()}:${granularity}`
  const cached = await cacheGet(cacheKey)
  if (cached) return cached

  const where = {
    username: username.toLowerCase(),
    snapshotDate: {},
  }

  if (from) where.snapshotDate.gte = from
  if (to) where.snapshotDate.lte = to
  if (granularity !== 'any') where.granularity = granularity

  try {
    const snapshots = await prisma.developerSnapshot.findMany({
      where,
      orderBy: { snapshotDate: 'asc' },
      take: limit,
    })

    await cacheSet(cacheKey, snapshots, 300) // 5 min cache
    return snapshots
  } catch (err) {
    console.warn(`[SnapshotEngine] Query failed for ${username}: ${err.message}`)
    return []
  }
}

/**
 * Get the most recent snapshot for a user.
 */
export async function getLatestSnapshot(username) {
  try {
    return await prisma.developerSnapshot.findFirst({
      where: { username: username.toLowerCase() },
      orderBy: { snapshotDate: 'desc' },
    })
  } catch {
    return null
  }
}

/**
 * Get the delta (change) in metrics over a period.
 *
 * @param {string} username
 * @param {number} periodDays — number of days to look back
 * @returns {{ current, previous, delta, growthRate }}
 */
export async function getSnapshotDelta(username, periodDays = 30) {
  const now = new Date()
  const pastDate = new Date(now.getTime() - periodDays * 86400000)

  const [current, previous] = await Promise.all([
    getLatestSnapshot(username),
    prisma.developerSnapshot.findFirst({
      where: {
        username: username.toLowerCase(),
        snapshotDate: { lte: pastDate },
      },
      orderBy: { snapshotDate: 'desc' },
    }).catch(() => null),
  ])

  if (!current) return null

  const delta = {
    commits: (current.commits || 0) - (previous?.commits || 0),
    repos: (current.repos || 0) - (previous?.repos || 0),
    stars: (current.stars || 0) - (previous?.stars || 0),
    followers: (current.followers || 0) - (previous?.followers || 0),
    activityScore: (current.activityScore || 0) - (previous?.activityScore || 0),
  }

  const growthRate = previous?.activityScore
    ? ((current.activityScore - previous.activityScore) / previous.activityScore) * 100
    : 0

  return {
    current: snapshotToMetrics(current),
    previous: previous ? snapshotToMetrics(previous) : null,
    delta,
    growthRate: Math.round(growthRate * 100) / 100,
    periodDays,
  }
}

/**
 * Aggregate snapshots into evenly-spaced time points.
 * For time-travel visualization that needs uniform intervals.
 *
 * @param {string} username
 * @param {Date} from
 * @param {Date} to
 * @param {number} numPoints — desired number of output points
 * @returns {Array} interpolated timeline points
 */
export async function aggregateSnapshots(username, from, to, numPoints = 12) {
  // Get all snapshots in range
  const snapshots = await getSnapshotsForUser(username, from, to, 'any', 1000)

  if (snapshots.length === 0) return []
  if (snapshots.length === 1) return snapshots.map(s => snapshotToTimelinePoint(s))

  const fromTime = from.getTime()
  const toTime = to.getTime()
  const interval = (toTime - fromTime) / (numPoints - 1)

  const result = []

  for (let i = 0; i < numPoints; i++) {
    const targetTime = fromTime + i * interval
    const targetDate = new Date(targetTime)

    // Find the closest snapshot to this target time
    let closest = snapshots[0]
    let closestDist = Math.abs(new Date(closest.snapshotDate).getTime() - targetTime)

    for (const snap of snapshots) {
      const dist = Math.abs(new Date(snap.snapshotDate).getTime() - targetTime)
      if (dist < closestDist) {
        closest = snap
        closestDist = dist
      }
    }

    // If closest is within 2 days, use it; otherwise interpolate between neighbors
    if (closestDist < 2 * 86400000) {
      result.push({
        ...snapshotToTimelinePoint(closest),
        date: targetDate.toISOString().slice(0, 10),
        source: 'recorded',
      })
    } else {
      // Find the two surrounding snapshots and interpolate
      const before = findBefore(snapshots, targetTime)
      const after = findAfter(snapshots, targetTime)

      if (before && after) {
        result.push({
          ...interpolateSnapshots(before, after, targetTime),
          date: targetDate.toISOString().slice(0, 10),
          source: 'interpolated',
        })
      } else if (before) {
        result.push({
          ...snapshotToTimelinePoint(before),
          date: targetDate.toISOString().slice(0, 10),
          source: 'extrapolated',
        })
      }
    }
  }

  return result
}

// ─── Scheduled Jobs ─────────────────────────────────────────

/**
 * Take daily snapshots for all registered users.
 */
async function takeDailySnapshots() {
  if (isRunning) {
    console.log('[SnapshotEngine] Already running, skipping...')
    return
  }

  isRunning = true
  const startTime = Date.now()
  console.log('[SnapshotEngine] Starting daily snapshot job...')

  try {
    const users = await prisma.user.findMany({
      where: { accessToken: { not: null } },
      select: { id: true, username: true, accessToken: true },
    })

    console.log(`[SnapshotEngine] Processing ${users.length} users`)

    let success = 0
    let failed = 0

    for (const user of users) {
      try {
        // Stagger to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))

        const token = user.accessToken || null
        const userData = await fetchUserData(user.username, token)
        await createSnapshot(user.id, userData, 'daily')

        success++
      } catch (err) {
        failed++
        console.warn(`[SnapshotEngine] ✗ ${user.username}: ${err.message}`)
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    stats.lastRunAt = new Date().toISOString()
    stats.lastRunDuration = Number(elapsed)
    stats.usersProcessed = success

    console.log(`[SnapshotEngine] Done: ${success} snapshots, ${failed} failed (${elapsed}s)`)
  } catch (err) {
    console.error('[SnapshotEngine] Fatal error:', err)
  } finally {
    isRunning = false
  }
}

/**
 * Clean up old hourly snapshots to prevent unbounded DB growth.
 */
async function cleanupOldSnapshots() {
  try {
    const hourlyThreshold = new Date(Date.now() - SNAPSHOT_RETENTION.hourly)

    const deleted = await prisma.developerSnapshot.deleteMany({
      where: {
        granularity: 'hourly',
        snapshotDate: { lt: hourlyThreshold },
      },
    })

    if (deleted.count > 0) {
      console.log(`[SnapshotEngine] Cleaned up ${deleted.count} old hourly snapshots`)
    }
  } catch (err) {
    console.warn(`[SnapshotEngine] Cleanup failed: ${err.message}`)
  }
}

/**
 * Start the snapshot engine with scheduled jobs.
 *
 * @param {Object} opts
 * @param {string} opts.dailyCron — daily snapshot schedule (default: midnight)
 * @param {string} opts.cleanupCron — cleanup schedule (default: 3 AM)
 */
export function startSnapshotEngine(opts = {}) {
  const { dailyCron = '0 0 * * *', cleanupCron = '0 3 * * *' } = opts

  console.log(`[SnapshotEngine] Scheduled: daily at ${dailyCron}, cleanup at ${cleanupCron}`)

  // Daily snapshots (midnight)
  dailyCronJob = cron.schedule(dailyCron, () => {
    takeDailySnapshots().catch(err => {
      console.error('[SnapshotEngine] Daily job error:', err)
    })
  })

  // Cleanup (3 AM)
  cleanupCronJob = cron.schedule(cleanupCron, () => {
    cleanupOldSnapshots().catch(err => {
      console.error('[SnapshotEngine] Cleanup error:', err)
    })
  })

  // Take initial snapshot after 60s delay (let DB/services warm up)
  setTimeout(() => {
    takeDailySnapshots().catch(err => {
      console.error('[SnapshotEngine] Initial run error:', err)
    })
  }, 60_000)

  console.log('[SnapshotEngine] Engine started')
}

export function stopSnapshotEngine() {
  if (dailyCronJob) { dailyCronJob.stop(); dailyCronJob = null }
  if (cleanupCronJob) { cleanupCronJob.stop(); cleanupCronJob = null }
  console.log('[SnapshotEngine] Stopped')
}

export function getSnapshotStats() {
  return { ...stats }
}

// ─── Helpers ────────────────────────────────────────────────

function snapshotToMetrics(snapshot) {
  return {
    commits: snapshot.commits,
    repos: snapshot.repos,
    stars: snapshot.stars,
    followers: snapshot.followers,
    activityScore: snapshot.activityScore,
    topLanguage: snapshot.topLanguage,
    recentActivity: snapshot.recentActivity,
    buildingHeight: snapshot.buildingHeight,
    buildingGlow: snapshot.buildingGlow,
  }
}

function snapshotToTimelinePoint(snapshot) {
  const d = new Date(snapshot.snapshotDate)
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    date: d.toISOString().slice(0, 10),
    commits: snapshot.commits,
    repos: snapshot.repos,
    stars: snapshot.stars,
    followers: snapshot.followers,
    activityScore: snapshot.activityScore,
    topLanguage: snapshot.topLanguage,
  }
}

function findBefore(snapshots, targetTime) {
  let best = null
  for (const s of snapshots) {
    const t = new Date(s.snapshotDate).getTime()
    if (t <= targetTime) best = s
  }
  return best
}

function findAfter(snapshots, targetTime) {
  for (const s of snapshots) {
    const t = new Date(s.snapshotDate).getTime()
    if (t >= targetTime) return s
  }
  return null
}

function interpolateSnapshots(before, after, targetTime) {
  const beforeTime = new Date(before.snapshotDate).getTime()
  const afterTime = new Date(after.snapshotDate).getTime()
  const t = (targetTime - beforeTime) / (afterTime - beforeTime) // 0..1

  return {
    year: new Date(targetTime).getFullYear(),
    month: new Date(targetTime).getMonth() + 1,
    commits: Math.round(before.commits + (after.commits - before.commits) * t),
    repos: Math.round(before.repos + (after.repos - before.repos) * t),
    stars: Math.round(before.stars + (after.stars - before.stars) * t),
    followers: Math.round(before.followers + (after.followers - before.followers) * t),
    activityScore: Math.round((before.activityScore + (after.activityScore - before.activityScore) * t) * 100) / 100,
    topLanguage: before.topLanguage,
  }
}
