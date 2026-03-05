import { Router } from 'express'
import express from 'express'
import crypto from 'crypto'
import { publishEvent, STREAMS } from '../services/messageQueue.js'
import prisma from '../db/prisma.js'

const router = Router()

/**
 * GitHub Webhook Ingestion Endpoint
 *
 * Architecture:
 *   GitHub → POST /api/webhooks/github → Verify Signature → Publish to Message Queue
 *
 * Supported events:
 *   push         — code pushed (commits)
 *   watch        — repo starred
 *   fork         — repo forked
 *   issues       — issue opened/closed
 *   pull_request — PR opened/merged/closed
 *   create       — branch/tag created
 *   release      — new release published
 *
 * Security:
 *   HMAC-SHA256 signature verification using GITHUB_WEBHOOK_SECRET.
 *   If no secret is configured, accepts all requests (development mode).
 *
 * Setup:
 *   1. Go to GitHub repo/org Settings → Webhooks → Add webhook
 *   2. Payload URL: https://your-domain.com/api/webhooks/github
 *   3. Content type: application/json
 *   4. Secret: same as GITHUB_WEBHOOK_SECRET env var
 *   5. Events: push, watch, fork, issues, pull_request, create, release
 */

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET

/**
 * Verify GitHub webhook HMAC-SHA256 signature.
 *
 * @param {Buffer} body — raw request body
 * @param {string} signature — X-Hub-Signature-256 header value
 * @returns {boolean}
 */
function verifySignature(body, signature) {
  if (!WEBHOOK_SECRET) return true // Dev mode: accept all
  if (!signature) return false

  const expected = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    )
  } catch {
    return false
  }
}

/**
 * Extract key information from GitHub webhook payload.
 * Normalizes different event types into a common structure.
 */
function extractEventData(eventType, payload) {
  const sender = payload.sender?.login || 'unknown'
  const repo = payload.repository?.full_name || null

  const base = {
    source: 'webhook',
    eventType,
    username: sender,
    repo,
    timestamp: new Date().toISOString(),
  }

  switch (eventType) {
    case 'push': {
      const commits = payload.commits || []
      return {
        ...base,
        branch: payload.ref?.replace('refs/heads/', '') || 'main',
        commitCount: commits.length,
        commits: commits.slice(0, 10).map(c => ({
          sha: c.id?.slice(0, 7),
          message: c.message?.split('\n')[0]?.slice(0, 120),
          author: c.author?.name || c.author?.username,
          added: c.added?.length || 0,
          modified: c.modified?.length || 0,
          removed: c.removed?.length || 0,
        })),
        forced: payload.forced || false,
        headCommit: payload.head_commit?.message?.split('\n')[0]?.slice(0, 120),
      }
    }

    case 'watch':
      return {
        ...base,
        action: payload.action || 'starred', // "started" = user starred the repo
        starCount: payload.repository?.stargazers_count || 0,
      }

    case 'fork':
      return {
        ...base,
        forkee: payload.forkee?.full_name,
        forkCount: payload.repository?.forks_count || 0,
      }

    case 'issues':
      return {
        ...base,
        action: payload.action, // opened, closed, reopened, labeled
        issueNumber: payload.issue?.number,
        issueTitle: payload.issue?.title?.slice(0, 120),
        issueState: payload.issue?.state,
        labels: (payload.issue?.labels || []).map(l => l.name).slice(0, 5),
      }

    case 'pull_request':
      return {
        ...base,
        action: payload.action, // opened, closed, merged, synchronize
        prNumber: payload.pull_request?.number,
        prTitle: payload.pull_request?.title?.slice(0, 120),
        prState: payload.pull_request?.state,
        merged: payload.pull_request?.merged || false,
        additions: payload.pull_request?.additions || 0,
        deletions: payload.pull_request?.deletions || 0,
        changedFiles: payload.pull_request?.changed_files || 0,
      }

    case 'create':
      return {
        ...base,
        refType: payload.ref_type, // branch, tag
        ref: payload.ref,
      }

    case 'release':
      return {
        ...base,
        action: payload.action, // published, created
        releaseName: payload.release?.name?.slice(0, 120),
        tagName: payload.release?.tag_name,
        prerelease: payload.release?.prerelease || false,
      }

    default:
      return {
        ...base,
        action: payload.action,
        raw: Object.keys(payload).slice(0, 10), // first 10 keys for debugging
      }
  }
}

/**
 * POST /api/webhooks/github
 *
 * Main webhook ingestion endpoint.
 * Verifies signature, extracts event data, publishes to message queue,
 * and stores in EventLog for audit trail.
 */
router.post('/github', express.raw({ type: 'application/json' }), async (req, res) => {
  const startTime = Date.now()

  try {
    // 1. Verify webhook signature
    const signature = req.headers['x-hub-signature-256']
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body))

    if (!verifySignature(rawBody, signature)) {
      console.warn('[Webhook] Signature verification failed')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    // 2. Parse payload
    const payload = req.body instanceof Buffer ? JSON.parse(rawBody.toString()) : req.body
    const eventType = req.headers['x-github-event']
    const deliveryId = req.headers['x-github-delivery']

    if (!eventType) {
      return res.status(400).json({ error: 'Missing X-GitHub-Event header' })
    }

    // 3. Handle ping event (webhook setup verification)
    if (eventType === 'ping') {
      console.log(`[Webhook] Ping received: ${payload.zen}`)
      return res.json({ ok: true, event: 'ping', zen: payload.zen })
    }

    // 4. Extract structured event data
    const eventData = extractEventData(eventType, payload)

    // 5. Publish to message queue (non-blocking pipeline)
    const messageId = await publishEvent(STREAMS.EVENTS, {
      deliveryId: deliveryId || `local-${Date.now()}`,
      ...eventData,
    })

    // 6. Store in EventLog for audit trail (fire-and-forget)
    storeEventLog(eventData).catch(() => {
      // Non-critical — queue processing is what matters
    })

    const elapsed = Date.now() - startTime
    console.log(`[Webhook] ${eventType} from ${eventData.username} → queued (${messageId}) [${elapsed}ms]`)

    res.status(202).json({
      ok: true,
      event: eventType,
      messageId,
      elapsed,
    })
  } catch (err) {
    console.error(`[Webhook] Processing error: ${err.message}`)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

/**
 * GET /api/webhooks/status
 *
 * Webhook pipeline health check.
 */
router.get('/status', async (_req, res) => {
  try {
    const recentCount = await prisma.eventLog.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 3600000) }, // last hour
      },
    }).catch(() => 0)

    const latestEvent = await prisma.eventLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { eventType: true, username: true, createdAt: true },
    }).catch(() => null)

    res.json({
      status: 'ok',
      pipeline: 'active',
      webhookSecret: WEBHOOK_SECRET ? 'configured' : 'not configured (dev mode)',
      lastHour: { events: recentCount },
      latestEvent,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/webhooks/events
 *
 * Recent event log (last 100 events).
 * Useful for debugging and monitoring.
 */
router.get('/events', async (req, res) => {
  try {
    const { limit = 50, eventType, username } = req.query

    const where = {}
    if (eventType) where.eventType = eventType
    if (username) where.username = username.toLowerCase()

    const events = await prisma.eventLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Number(limit)),
    })

    res.json({
      events,
      count: events.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * Store event in the EventLog table for audit trail.
 * Non-critical — failures don't affect the pipeline.
 */
async function storeEventLog(eventData) {
  try {
    await prisma.eventLog.create({
      data: {
        source: eventData.source || 'webhook',
        eventType: eventData.eventType,
        username: eventData.username?.toLowerCase(),
        repo: eventData.repo,
        payload: eventData,
      },
    })
  } catch (err) {
    console.warn(`[Webhook] EventLog write failed: ${err.message}`)
  }
}

export default router
