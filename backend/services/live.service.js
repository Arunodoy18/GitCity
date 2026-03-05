import { WebSocketServer } from 'ws'
import { cacheGet, cacheSet } from '../cache/redis.client.js'

/**
 * GitCity Live Commit WebSocket Service
 *
 * Provides real-time commit notifications to connected clients.
 * When a commit is pushed → building lights flash in the city.
 *
 * Protocol (JSON messages):
 *
 * Client → Server:
 *   { type: "subscribe", usernames: ["torvalds", "gaearon"] }
 *   { type: "unsubscribe", usernames: ["torvalds"] }
 *   { type: "ping" }
 *
 * Server → Client:
 *   { type: "commit", username, repo, message, timestamp, files }
 *   { type: "activity", username, eventType, repo, timestamp }
 *   { type: "subscribed", usernames: [...] }
 *   { type: "pong" }
 *   { type: "stats", connectedClients, trackedUsers }
 */

const POLL_INTERVAL = 15_000 // Poll GitHub events every 15s
const MAX_SUBSCRIPTIONS = 50 // Max usernames per client

let wss = null
let pollTimer = null
const clientSubscriptions = new Map() // ws → Set<username>
const clientTokens = new Map()        // ws → accessToken (from auth)
const lastEventIds = new Map() // username → lastEventId

/**
 * Get the best available OAuth token for a tracked username.
 * Finds any connected client subscribed to this user that has a token.
 */
function getSubscriberToken(username) {
  const userLower = username.toLowerCase()
  for (const [ws, subs] of clientSubscriptions.entries()) {
    if (subs.has(userLower) && clientTokens.has(ws)) {
      return clientTokens.get(ws)
    }
  }
  return null
}

/**
 * Attach WebSocket server to an existing HTTP server.
 */
export function attachWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws/live' })

  wss.on('connection', (ws) => {
    clientSubscriptions.set(ws, new Set())

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        handleClientMessage(ws, msg)
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }))
      }
    })

    ws.on('close', () => {
      clientSubscriptions.delete(ws)
      clientTokens.delete(ws)
    })

    ws.on('error', () => {
      clientSubscriptions.delete(ws)
      clientTokens.delete(ws)
    })

    // Welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Welcome to GitCity Live',
      timestamp: new Date().toISOString(),
    }))
  })

  // Start polling for events
  startPolling()

  console.log('[WebSocket] Live commit service attached at /ws/live')
  return wss
}

function handleClientMessage(ws, msg) {
  switch (msg.type) {
    case 'subscribe': {
      const subs = clientSubscriptions.get(ws) || new Set()
      const usernames = (msg.usernames || []).slice(0, MAX_SUBSCRIPTIONS)
      for (const u of usernames) {
        subs.add(u.toLowerCase())
      }
      clientSubscriptions.set(ws, subs)
      // Store auth token if provided (used for GitHub API polling)
      if (msg.token) {
        clientTokens.set(ws, msg.token)
      }
      ws.send(JSON.stringify({
        type: 'subscribed',
        usernames: [...subs],
      }))
      break
    }

    case 'unsubscribe': {
      const subs = clientSubscriptions.get(ws)
      if (subs) {
        for (const u of (msg.usernames || [])) {
          subs.delete(u.toLowerCase())
        }
      }
      ws.send(JSON.stringify({
        type: 'subscribed',
        usernames: [...(subs || [])],
      }))
      break
    }

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }))
      break

    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }))
  }
}

/**
 * Poll GitHub Events API for tracked usernames and broadcast commits.
 */
function startPolling() {
  if (pollTimer) return

  pollTimer = setInterval(async () => {
    // Collect all unique tracked usernames across all clients
    const allUsernames = new Set()
    for (const subs of clientSubscriptions.values()) {
      for (const u of subs) allUsernames.add(u)
    }

    if (allUsernames.size === 0) return

    for (const username of allUsernames) {
      try {
        await pollUserEvents(username)
      } catch {
        // Non-critical — skip failed polls
      }
    }

    // Broadcast stats periodically
    broadcastToAll({
      type: 'stats',
      connectedClients: wss?.clients?.size || 0,
      trackedUsers: allUsernames.size,
      timestamp: new Date().toISOString(),
    })
  }, POLL_INTERVAL)
}

async function pollUserEvents(username) {
  const cacheKey = `events:${username}`
  const cached = await cacheGet(cacheKey)

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GitCity-Live',
  }
  // Use subscriber's OAuth token if available for higher rate limits
  const subscriberToken = getSubscriberToken(username)
  if (subscriberToken) {
    headers['Authorization'] = `Bearer ${subscriberToken}`
  }

  // Use ETag/If-Modified-Since for efficient polling
  const fetchOpts = { headers }

  const res = await fetch(
    `https://api.github.com/users/${username}/events/public?per_page=10`,
    fetchOpts,
  )

  if (!res.ok) return

  const events = await res.json()
  const lastId = lastEventIds.get(username) || '0'
  const newEvents = []

  for (const event of events) {
    if (event.id <= lastId) break
    newEvents.push(event)
  }

  if (newEvents.length === 0) return
  if (events[0]) lastEventIds.set(username, events[0].id)

  // Cache events briefly
  await cacheSet(cacheKey, events.slice(0, 5), 30)

  // Broadcast new events to subscribed clients
  for (const event of newEvents.reverse()) {
    const payload = formatEvent(username, event)
    if (payload) {
      broadcastToSubscribers(username, payload)
    }
  }
}

function formatEvent(username, event) {
  switch (event.type) {
    case 'PushEvent': {
      const commits = event.payload?.commits || []
      return {
        type: 'commit',
        username,
        repo: event.repo?.name || 'unknown',
        branch: event.payload?.ref?.replace('refs/heads/', '') || 'main',
        commits: commits.slice(0, 5).map(c => ({
          sha: c.sha?.slice(0, 7),
          message: c.message?.split('\n')[0]?.slice(0, 100),
          author: c.author?.name,
        })),
        commitCount: commits.length,
        timestamp: event.created_at,
      }
    }
    case 'CreateEvent':
    case 'WatchEvent':
    case 'ForkEvent':
    case 'IssuesEvent':
    case 'PullRequestEvent':
      return {
        type: 'activity',
        username,
        eventType: event.type.replace('Event', ''),
        repo: event.repo?.name || 'unknown',
        timestamp: event.created_at,
      }
    default:
      return null
  }
}

function broadcastToSubscribers(username, payload) {
  const msg = JSON.stringify(payload)
  const userLower = username.toLowerCase()

  for (const [ws, subs] of clientSubscriptions.entries()) {
    if (subs.has(userLower) && ws.readyState === 1) {
      ws.send(msg)
    }
  }
}

function broadcastToAll(payload) {
  if (!wss) return
  const msg = JSON.stringify(payload)
  for (const ws of wss.clients) {
    if (ws.readyState === 1) ws.send(msg)
  }
}

/**
 * Manually push a commit event (e.g., from webhook or event processor).
 */
export function pushCommitEvent(username, data) {
  broadcastToSubscribers(username, {
    type: 'commit',
    username,
    ...data,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Broadcast a non-commit activity event (star, fork, PR, issue, etc.)
 * Used by the event processor for real-time pipeline events.
 */
export function broadcastActivity(username, data) {
  broadcastToSubscribers(username, {
    type: 'activity',
    username,
    ...data,
    timestamp: new Date().toISOString(),
  })

  // Also broadcast to all clients as a global activity feed event
  broadcastToAll({
    type: 'global-activity',
    username,
    eventType: data.eventType,
    repo: data.repo,
    details: data.details,
    source: data.source || 'poll',
    timestamp: new Date().toISOString(),
  })
}

/**
 * Get current stats.
 */
export function getLiveStats() {
  const allUsernames = new Set()
  for (const subs of clientSubscriptions.values()) {
    for (const u of subs) allUsernames.add(u)
  }
  return {
    connectedClients: wss?.clients?.size || 0,
    trackedUsers: allUsernames.size,
    subscriptions: clientSubscriptions.size,
  }
}

export function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
