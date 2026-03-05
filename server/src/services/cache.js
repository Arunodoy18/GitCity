/**
 * In-memory cache with TTL
 * Key → { data, expiry }
 */
const store = new Map()

const DEFAULT_TTL = 10 * 60 * 1000 // 10 minutes

export function getCached(key) {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    store.delete(key)
    return null
  }
  return entry.data
}

export function setCache(key, data, ttl = DEFAULT_TTL) {
  store.set(key, {
    data,
    expiry: Date.now() + ttl,
  })
}

export function getCacheStats() {
  let active = 0
  let expired = 0
  for (const [key, entry] of store) {
    if (Date.now() > entry.expiry) {
      expired++
      store.delete(key)
    } else {
      active++
    }
  }
  return { active, expired, total: store.size }
}
