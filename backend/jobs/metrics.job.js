import cron from 'node-cron'
import prisma from '../db/prisma.js'
import { fetchUserData } from '../services/github.service.js'
import { getOrComputeMetrics } from '../services/metrics.service.js'
import { createSnapshot } from '../services/snapshotEngine.js'

/**
 * Metrics Background Job — Refreshes GitHub data and metrics for all registered users.
 *
 * Runs every 10 minutes. For each active user:
 * 1. Fetches fresh GitHub data (using their access token → 5000 req/hr)
 * 2. Recomputes metrics
 * 3. Stores snapshot in DB (Metric table + DeveloperSnapshot table)
 * 4. Updates Redis cache
 *
 * Upgrade 3 integration: Also creates DeveloperSnapshot entries for time-series.
 * Staggered per-user to avoid rate limit bursts.
 */

let isRunning = false

async function refreshAllUsers() {
  if (isRunning) {
    console.log('[MetricsJob] Already running, skipping...')
    return
  }

  isRunning = true
  const startTime = Date.now()
  console.log('[MetricsJob] Starting metrics refresh...')

  try {
    // Get all users with access tokens (registered via OAuth)
    const users = await prisma.user.findMany({
      where: {
        accessToken: { not: null },
      },
      select: {
        id: true,
        username: true,
        accessToken: true,
      },
    })

    console.log(`[MetricsJob] Processing ${users.length} users`)

    let success = 0
    let failed = 0

    for (const user of users) {
      try {
        // Stagger by 500ms between users to be gentle on GitHub API
        await new Promise(resolve => setTimeout(resolve, 500))

        const userData = await fetchUserData(user.username, user.accessToken)
        await getOrComputeMetrics(user.id, userData)

        // Upgrade 3: Also create a snapshot for time-series tracking
        await createSnapshot(user.id, userData, 'hourly').catch(() => {
          // Non-critical — snapshot engine failure shouldn't block metrics refresh
        })

        success++
        console.log(`[MetricsJob] ✓ ${user.username}`)
      } catch (err) {
        failed++
        console.warn(`[MetricsJob] ✗ ${user.username}: ${err.message}`)
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[MetricsJob] Done: ${success} ok, ${failed} failed (${elapsed}s)`)
  } catch (err) {
    console.error('[MetricsJob] Fatal error:', err)
  } finally {
    isRunning = false
  }
}

/**
 * Start the background metrics refresh job.
 * Runs every 10 minutes by default.
 */
export function startMetricsJob(cronSchedule = '*/10 * * * *') {
  console.log(`[MetricsJob] Scheduled: ${cronSchedule}`)

  cron.schedule(cronSchedule, () => {
    refreshAllUsers().catch(err => {
      console.error('[MetricsJob] Unhandled error:', err)
    })
  })

  // Run once at startup (after 30s delay to let DB warm up)
  setTimeout(() => {
    refreshAllUsers().catch(err => {
      console.error('[MetricsJob] Initial run error:', err)
    })
  }, 30_000)
}

export { refreshAllUsers }
