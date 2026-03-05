import {
  createConsumerGroup,
  startConsumerLoop,
  publishEvent,
  STREAMS,
  CONSUMER_GROUPS,
} from './messageQueue.js'
import { pushCommitEvent, broadcastActivity } from './live.service.js'
import { computeMetrics } from './metrics.service.js'
import { fetchUserData } from './github.service.js'
import { cacheGet, cacheSet, cacheDel } from '../cache/redis.client.js'
import prisma from '../db/prisma.js'

/**
 * GitCity Event Processor — Real-Time Pipeline Core
 *
 * Architecture:
 *   Message Queue (STREAMS.EVENTS) → Event Processor → [Metrics Update, WebSocket Broadcast, Cache Invalidation]
 *
 * Pipeline:
 *   1. Consume raw GitHub events from message queue
 *   2. Classify event impact (high: push/PR merge, medium: star/fork, low: issue comment)
 *   3. Update metrics for affected user (invalidate cache, recompute if high-impact)
 *   4. Broadcast to WebSocket subscribers (real-time city updates)
 *   5. Mark EventLog as processed
 *
 * Deduplication:
 *   Uses deliveryId from GitHub to prevent processing the same event twice.
 *
 * Rate limiting:
 *   Metrics recomputation is throttled to once per 60s per user to prevent
 *   GitHub API hammering during burst events (e.g., 50 commits pushed at once).
 */

const METRICS_THROTTLE_MS = 60_000 // 1 min between metrics recomputations per user
const metricsLastComputed = new Map() // username → timestamp

let consumerLoop = null
let stats = {
  processed: 0,
  errors: 0,
  metricsUpdated: 0,
  broadcasts: 0,
  startedAt: null,
}

/**
 * Initialize the event processor pipeline.
 * Creates consumer groups and starts the consumer loop.
 */
export async function startEventProcessor() {
  console.log('[EventProcessor] Initializing real-time event pipeline...')
  stats.startedAt = new Date().toISOString()

  // Create consumer groups (idempotent)
  await createConsumerGroup(STREAMS.EVENTS, CONSUMER_GROUPS.EVENT_PROCESSOR)

  // Start consumer loop
  consumerLoop = startConsumerLoop({
    stream: STREAMS.EVENTS,
    group: CONSUMER_GROUPS.EVENT_PROCESSOR,
    consumer: `processor-${process.pid}`,
    handler: processEventBatch,
    count: 20,
    blockMs: 2000,
  })

  console.log('[EventProcessor] Pipeline active — consuming from gitcity:events')
}

/**
 * Stop the event processor gracefully.
 */
export function stopEventProcessor() {
  if (consumerLoop) {
    consumerLoop.stop()
    consumerLoop = null
  }
  console.log('[EventProcessor] Stopped')
}

/**
 * Process a batch of events from the message queue.
 *
 * @param {Array<{id: string, fields: Object}>} messages
 */
async function processEventBatch(messages) {
  for (const msg of messages) {
    try {
      await processEvent(msg.id, msg.fields)
      stats.processed++
    } catch (err) {
      stats.errors++
      console.error(`[EventProcessor] Failed to process event ${msg.id}: ${err.message}`)
    }
  }
}

/**
 * Process a single event through the pipeline.
 *
 * @param {string} messageId — queue message ID
 * @param {Object} event — parsed event data
 */
async function processEvent(messageId, event) {
  const { eventType, username, repo, source, deliveryId } = event

  // 1. Deduplication check
  if (deliveryId) {
    const dedupeKey = `event:seen:${deliveryId}`
    const seen = await cacheGet(dedupeKey)
    if (seen) return // Already processed
    await cacheSet(dedupeKey, true, 3600) // Remember for 1 hour
  }

  // 2. Classify event impact
  const impact = classifyImpact(eventType, event)

  // 3. Broadcast to WebSocket (always — this is real-time)
  await broadcastEvent(eventType, username, event)
  stats.broadcasts++

  // 4. Update metrics (throttled for high/medium impact)
  if (impact === 'high' || impact === 'medium') {
    await throttledMetricsUpdate(username)
  }

  // 5. Cache invalidation
  await invalidateUserCache(username)

  // 6. Mark EventLog as processed
  await markEventProcessed(deliveryId || messageId)
}

/**
 * Classify event impact level for metrics processing priority.
 *
 * @returns {'high'|'medium'|'low'|'info'}
 */
function classifyImpact(eventType, event) {
  switch (eventType) {
    case 'push':
      return (event.commitCount || 0) > 0 ? 'high' : 'low'

    case 'pull_request':
      return event.merged ? 'high' : (event.action === 'opened' ? 'medium' : 'low')

    case 'watch': // star
    case 'fork':
      return 'medium'

    case 'issues':
      return event.action === 'opened' || event.action === 'closed' ? 'medium' : 'low'

    case 'create':
      return event.refType === 'tag' ? 'medium' : 'low'

    case 'release':
      return 'medium'

    default:
      return 'info'
  }
}

/**
 * Broadcast event to WebSocket subscribers.
 * Maps event types to the live.service.js protocol.
 */
async function broadcastEvent(eventType, username, event) {
  switch (eventType) {
    case 'push':
      pushCommitEvent(username, {
        repo: event.repo,
        branch: event.branch,
        commits: event.commits,
        commitCount: event.commitCount,
        source: 'webhook', // distinguishes from polling
      })
      break

    case 'pull_request':
    case 'issues':
    case 'watch':
    case 'fork':
    case 'create':
    case 'release':
      broadcastActivity(username, {
        eventType: eventType.replace('_', '-'),
        repo: event.repo,
        action: event.action,
        details: summarizeEvent(eventType, event),
        source: 'webhook',
      })
      break

    default:
      // Unknown events still get broadcast as generic activity
      broadcastActivity(username, {
        eventType,
        repo: event.repo,
        source: 'webhook',
      })
  }
}

/**
 * Generate a human-readable summary of an event.
 */
function summarizeEvent(eventType, event) {
  switch (eventType) {
    case 'push':
      return `Pushed ${event.commitCount || 0} commit(s) to ${event.branch || 'main'}`

    case 'pull_request':
      return `${event.action} PR #${event.prNumber}: ${event.prTitle || 'untitled'}`

    case 'issues':
      return `${event.action} issue #${event.issueNumber}: ${event.issueTitle || 'untitled'}`

    case 'watch':
      return `Starred ${event.repo} (${event.starCount || '?'} total)`

    case 'fork':
      return `Forked ${event.repo} → ${event.forkee || 'unknown'}`

    case 'create':
      return `Created ${event.refType} ${event.ref}`

    case 'release':
      return `Released ${event.tagName}: ${event.releaseName || 'untitled'}`

    default:
      return `${eventType} event`
  }
}

/**
 * Throttled metrics recomputation.
 * Prevents GitHub API hammering during burst events.
 */
async function throttledMetricsUpdate(username) {
  const now = Date.now()
  const lastComputed = metricsLastComputed.get(username) || 0

  if (now - lastComputed < METRICS_THROTTLE_MS) {
    return // Throttled — too recent
  }

  metricsLastComputed.set(username, now)

  try {
    // Fetch fresh data from GitHub
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true, accessToken: true },
    }).catch(() => null)

    const token = user?.accessToken || null
    const userData = await fetchUserData(username, token)
    const metrics = computeMetrics(userData)

    // Store updated metrics in DB
    if (user) {
      await prisma.metric.create({
        data: {
          userId: user.id,
          commits: metrics.commits,
          repos: metrics.repos,
          stars: metrics.stars,
          followers: metrics.followers,
          activityScore: metrics.activityScore,
          topLanguage: metrics.topLanguage,
          recentActivity: metrics.recentActivity,
        },
      }).catch(() => {
        // Non-critical
      })
    }

    // Update cache
    await cacheSet(`metrics:user:${username.toLowerCase()}`, metrics, 300)
    stats.metricsUpdated++

    console.log(`[EventProcessor] Metrics updated for ${username}`)
  } catch (err) {
    console.warn(`[EventProcessor] Metrics update failed for ${username}: ${err.message}`)
  }
}

/**
 * Invalidate cached data for a user after an event.
 */
async function invalidateUserCache(username) {
  const lower = username.toLowerCase()
  await cacheDel(`github:user:${lower}`)
  await cacheDel(`timeline:${lower}`) // Partial key — won't match all timeline keys, but that's ok
}

/**
 * Mark an EventLog entry as processed.
 */
async function markEventProcessed(deliveryId) {
  try {
    // Find by deliveryId in payload JSON, or just update the most recent unprocessed one
    await prisma.eventLog.updateMany({
      where: {
        processedAt: null,
        createdAt: { gte: new Date(Date.now() - 60000) }, // last minute
      },
      data: {
        processedAt: new Date(),
      },
    })
  } catch {
    // Non-critical
  }
}

/**
 * Get event processor statistics.
 */
export function getProcessorStats() {
  return {
    ...stats,
    throttleMap: metricsLastComputed.size,
    uptime: stats.startedAt
      ? Math.round((Date.now() - new Date(stats.startedAt).getTime()) / 1000)
      : 0,
  }
}
