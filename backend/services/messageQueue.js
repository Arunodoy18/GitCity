import { redis } from '../cache/redis.client.js'

/**
 * GitCity Message Queue — Redis Streams with In-Memory Fallback
 *
 * Architecture:
 *   Producer (webhook/poll) → XADD stream → Consumer Group → Event Processor
 *
 * Streams:
 *   gitcity:events      — all GitHub events (push, star, fork, PR, issue)
 *   gitcity:metrics      — metrics recomputation requests
 *   gitcity:broadcasts    — WebSocket broadcast commands
 *
 * Consumer Groups:
 *   event-processor      — processes raw events → metrics + broadcast
 *   snapshot-writer      — writes periodic snapshots to DB
 *
 * In-memory fallback: event-driven queue using arrays + callbacks
 * (same API, same guarantees — just no persistence across restarts)
 */

const STREAMS = {
  EVENTS: 'gitcity:events',
  METRICS: 'gitcity:metrics',
  BROADCASTS: 'gitcity:broadcasts',
}

const CONSUMER_GROUPS = {
  EVENT_PROCESSOR: 'event-processor',
  SNAPSHOT_WRITER: 'snapshot-writer',
}

// ─── In-Memory Fallback Queue ───────────────────────────────
// Used when Redis is unavailable. Same API, synchronous delivery.
const fallbackQueues = new Map()       // stream → [{id, fields, pending}]
const fallbackListeners = new Map()    // stream:group → callback
let fallbackIdCounter = 0

function getFallbackQueue(stream) {
  if (!fallbackQueues.has(stream)) fallbackQueues.set(stream, [])
  return fallbackQueues.get(stream)
}

// ─── Core API ───────────────────────────────────────────────

/**
 * Publish an event to a stream.
 *
 * @param {string} stream — stream name (use STREAMS constants)
 * @param {Object} data — event payload (flat key-value, values auto-stringified)
 * @returns {Promise<string>} — message ID
 */
export async function publishEvent(stream, data) {
  // Flatten data for Redis Streams (must be key-value pairs of strings)
  const fields = []
  for (const [key, value] of Object.entries(data)) {
    fields.push(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
  }

  if (redis) {
    try {
      const id = await redis.xadd(stream, '*', ...fields)
      return id
    } catch (err) {
      console.warn(`[MessageQueue] Redis XADD failed, falling back: ${err.message}`)
    }
  }

  // In-memory fallback
  const queue = getFallbackQueue(stream)
  const id = `${Date.now()}-${fallbackIdCounter++}`
  const entry = { id, data, timestamp: Date.now() }
  queue.push(entry)

  // Trim to prevent memory leak (keep last 10,000)
  if (queue.length > 10000) queue.splice(0, queue.length - 10000)

  // Immediately dispatch to any registered listeners
  for (const [key, callback] of fallbackListeners.entries()) {
    if (key.startsWith(stream + ':')) {
      try {
        await callback([{ id, fields: data }])
      } catch (err) {
        console.warn(`[MessageQueue] Fallback listener error: ${err.message}`)
      }
    }
  }

  return id
}

/**
 * Create a consumer group for a stream.
 * Idempotent — safe to call multiple times.
 *
 * @param {string} stream — stream name
 * @param {string} group — consumer group name
 */
export async function createConsumerGroup(stream, group) {
  if (redis) {
    try {
      // Create the stream with a dummy entry if it doesn't exist, then create group
      await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM')
      console.log(`[MessageQueue] Consumer group "${group}" created on "${stream}"`)
    } catch (err) {
      // BUSYGROUP = group already exists — perfectly fine
      if (!err.message?.includes('BUSYGROUP')) {
        console.warn(`[MessageQueue] Group creation warning: ${err.message}`)
      }
    }
    return
  }

  // Fallback: just ensure the queue exists
  getFallbackQueue(stream)
  console.log(`[MessageQueue] Consumer group "${group}" registered (in-memory) on "${stream}"`)
}

/**
 * Consume events from a stream as part of a consumer group.
 * Blocking read — waits up to `blockMs` for new events.
 *
 * @param {string} stream — stream name
 * @param {string} group — consumer group name
 * @param {string} consumer — consumer name (unique per instance)
 * @param {number} count — max events to read per call
 * @param {number} blockMs — block timeout in ms (0 = no block)
 * @returns {Promise<Array<{id: string, fields: Object}>>}
 */
export async function consumeEvents(stream, group, consumer, count = 10, blockMs = 2000) {
  if (redis) {
    try {
      const result = await redis.xreadgroup(
        'GROUP', group, consumer,
        'COUNT', count,
        'BLOCK', blockMs,
        'STREAMS', stream, '>'
      )

      if (!result) return []

      // Parse Redis stream result: [[streamName, [[id, [field, val, field, val, ...]], ...]]]
      const messages = []
      for (const [, entries] of result) {
        for (const [id, fieldArray] of entries) {
          const fields = {}
          for (let i = 0; i < fieldArray.length; i += 2) {
            const val = fieldArray[i + 1]
            // Try to parse JSON values back
            try { fields[fieldArray[i]] = JSON.parse(val) } catch { fields[fieldArray[i]] = val }
          }
          messages.push({ id, fields })
        }
      }

      return messages
    } catch (err) {
      // Don't spam logs for timeout/connection issues
      if (!err.message?.includes('NOGROUP') && !err.message?.includes('writeable') && !err.message?.includes('enableOfflineQueue')) {
        console.warn(`[MessageQueue] XREADGROUP error: ${err.message}`)
      }
      // Delay to prevent tight loop spinning when disconnected
      await new Promise(r => setTimeout(r, 2000))
      return []
    }
  }

  // Fallback: return nothing (listeners are called synchronously on publish)
  return []
}

/**
 * Acknowledge a processed message.
 *
 * @param {string} stream
 * @param {string} group
 * @param {string} messageId
 */
export async function ackEvent(stream, group, messageId) {
  if (redis) {
    try {
      await redis.xack(stream, group, messageId)
    } catch {
      // Non-critical
    }
    return
  }
  // Fallback: no-op (already dispatched synchronously)
}

/**
 * Register a callback for in-memory fallback queue.
 * Only used when Redis is unavailable — provides synchronous event delivery.
 *
 * @param {string} stream
 * @param {string} group
 * @param {Function} callback — async (messages: Array<{id, fields}>) => void
 */
export function registerFallbackListener(stream, group, callback) {
  fallbackListeners.set(`${stream}:${group}`, callback)
}

/**
 * Start a persistent consumer loop. Runs until stopped.
 * Handles reconnection and error recovery automatically.
 *
 * @param {Object} opts
 * @param {string} opts.stream
 * @param {string} opts.group
 * @param {string} opts.consumer
 * @param {Function} opts.handler — async (messages) => void
 * @param {number} opts.count — messages per read (default 10)
 * @param {number} opts.blockMs — block timeout (default 2000)
 * @returns {{ stop: Function }} — call stop() to end the loop
 */
export function startConsumerLoop({ stream, group, consumer, handler, count = 10, blockMs = 2000 }) {
  let running = true

  // Also register as fallback listener
  registerFallbackListener(stream, group, handler)

  const loop = async () => {
    while (running) {
      try {
        const messages = await consumeEvents(stream, group, consumer, count, blockMs)
        if (messages.length > 0) {
          await handler(messages)
          // Ack all processed messages
          for (const msg of messages) {
            await ackEvent(stream, group, msg.id)
          }
        }
      } catch (err) {
        console.error(`[MessageQueue] Consumer loop error: ${err.message}`)
        // Back off on error
        await new Promise(r => setTimeout(r, 5000))
      }
    }
  }

  // Only start the Redis polling loop if Redis is available
  // (fallback uses synchronous dispatch via registerFallbackListener)
  if (redis) {
    loop().catch(err => console.error(`[MessageQueue] Fatal loop error: ${err.message}`))
  }

  return {
    stop() {
      running = false
      fallbackListeners.delete(`${stream}:${group}`)
    },
  }
}

/**
 * Get stream info (length, consumer groups, etc.)
 */
export async function getStreamInfo(stream) {
  if (redis) {
    try {
      const info = await redis.xinfo('STREAM', stream)
      // Parse flat array into object
      const result = {}
      for (let i = 0; i < info.length; i += 2) {
        result[info[i]] = info[i + 1]
      }
      return result
    } catch {
      return null
    }
  }

  // Fallback
  const queue = fallbackQueues.get(stream)
  return {
    length: queue?.length || 0,
    groups: fallbackListeners.size,
    mode: 'in-memory',
  }
}

/**
 * Trim a stream to keep only the last N entries (prevents unbounded growth).
 */
export async function trimStream(stream, maxLen = 50000) {
  if (redis) {
    try {
      await redis.xtrim(stream, 'MAXLEN', '~', maxLen)
    } catch {
      // Non-critical
    }
    return
  }

  // Fallback trim
  const queue = getFallbackQueue(stream)
  if (queue.length > maxLen) queue.splice(0, queue.length - maxLen)
}

export { STREAMS, CONSUMER_GROUPS }
