import Redis from 'ioredis'
import dotenv from 'dotenv'
dotenv.config()

/**
 * Redis Client — Connection + helpers for GitCity caching layer.
 *
 * Keys convention:
 *   github:user:<username>   — cached GitHub user profile + metrics
 *   metrics:user:<username>  — computed metrics snapshot
 *   session:<sessionId>      — user session data
 *
 * Falls back to in-memory Map if Redis is unavailable (dev convenience).
 */

let redis = null
let fallbackMap = null
let usingFallback = false

function createClient() {
  if (redis || usingFallback) return redis

  const url = process.env.REDIS_URL || 'redis://localhost:6379'

  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 3) {
          // Silently switch to fallback — no more retries
          return null
        }
        return Math.min(times * 200, 1000)
      },
      lazyConnect: true,
      enableOfflineQueue: false,
      showFriendlyErrorStack: false,
    })

    redis.on('connect', () => console.log('[Redis] Connected'))

    redis.on('error', () => {
      // Switch to in-memory fallback silently (logged once below)
      if (!usingFallback) {
        usingFallback = true
        console.log('[Cache] Redis unavailable — using in-memory fallback')
        fallbackMap = new Map()
      }
      // Disconnect cleanly to stop reconnect loop
      if (redis) {
        redis.disconnect(false)
        redis = null
      }
    })

    redis.connect().catch(() => {
      if (!usingFallback) {
        usingFallback = true
        console.log('[Cache] Redis unavailable — using in-memory fallback')
        fallbackMap = new Map()
      }
      if (redis) {
        redis.disconnect(false)
        redis = null
      }
    })
  } catch {
    usingFallback = true
    console.log('[Cache] Redis init failed — using in-memory fallback')
    fallbackMap = new Map()
  }

  return redis
}

// Initialize on import
createClient()

/**
 * Get a cached value by key
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function cacheGet(key) {
  if (redis) {
    try {
      const val = await redis.get(key)
      return val ? JSON.parse(val) : null
    } catch {
      return null
    }
  }
  // Fallback
  if (fallbackMap) {
    const entry = fallbackMap.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiry) { fallbackMap.delete(key); return null }
    return entry.data
  }
  return null
}

/**
 * Set a cached value with TTL
 * @param {string} key
 * @param {any} data — will be JSON.stringified
 * @param {number} ttlSeconds — default 600 (10 min)
 */
export async function cacheSet(key, data, ttlSeconds = 600) {
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds)
    } catch { /* ignore */ }
    return
  }
  // Fallback
  if (!fallbackMap) fallbackMap = new Map()
  fallbackMap.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 })
}

/**
 * Delete a cached key
 */
export async function cacheDel(key) {
  if (redis) {
    try { await redis.del(key) } catch { /* ignore */ }
    return
  }
  if (fallbackMap) fallbackMap.delete(key)
}

/**
 * Flush all keys matching a pattern
 */
export async function cacheFlush(pattern = '*') {
  if (redis) {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) await redis.del(...keys)
    } catch { /* ignore */ }
    return
  }
  if (fallbackMap) fallbackMap.clear()
}

export { redis }
