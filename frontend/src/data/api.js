/**
 * GitCity Frontend API Layer — SaaS Edition
 *
 * Points to the new backend (port 5000) for auth + data routes.
 * Maintains backward compatibility with existing data format.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

/**
 * Best-effort backend warmup to reduce cold-start delay before OAuth redirect.
 * Returns true when the health endpoint responds, false otherwise.
 */
export async function warmBackend({ timeoutMs = 12000 } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

/** Get stored auth token */
function getToken() {
  return localStorage.getItem('gitcity_token')
}

/** Build fetch headers with optional auth */
function authHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

/**
 * Fetch a single GitHub user's city data
 */
export async function fetchUser(username) {
  const res = await fetch(`${API_BASE}/api/user/${encodeURIComponent(username)}`, {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to fetch user: ${res.status}`)
  }
  return res.json()
}

/**
 * Fetch multiple users at once
 */
export async function fetchCityUsers(usernames) {
  const param = usernames.map(u => encodeURIComponent(u)).join(',')
  const res = await fetch(`${API_BASE}/api/city/multi?users=${param}`, {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to fetch city: ${res.status}`)
  }
  return res.json()
}

/**
 * Get current authenticated user's profile
 */
export async function fetchMe() {
  const token = getToken()
  if (!token) return null
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.user
}

/**
 * Get authenticated user's personal city data
 */
export async function fetchMyCity() {
  const res = await fetch(`${API_BASE}/api/city`, {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to fetch city: ${res.status}`)
  }
  return res.json()
}

/**
 * Save city snapshot
 */
export async function saveCitySnapshot(citySnapshot, metricsData = null) {
  const res = await fetch(`${API_BASE}/api/city/save`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({ citySnapshot, metricsData }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Failed to save city: ${res.status}`)
  }
  return res.json()
}

/**
 * Logout — clear token and session */
export async function logout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
    })
  } catch { /* ignore */ }
  localStorage.removeItem('gitcity_token')
}

/** Get GitHub OAuth login URL (full page redirect) */
export function getLoginUrl() {
  return `${API_BASE}/auth/github`
}

// ─── Feature 1: Global Developer City ───────────────────────
export async function fetchGlobalCity({ page = 1, limit = 50, search, language, sort } = {}) {
  const params = new URLSearchParams({ page, limit })
  if (search) params.set('search', search)
  if (language) params.set('language', language)
  if (sort) params.set('sort', sort)
  const res = await fetch(`${API_BASE}/api/global?${params}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Global city fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchGlobalStats() {
  const res = await fetch(`${API_BASE}/api/global/stats`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Global stats fetch failed: ${res.status}`)
  return res.json()
}

// ─── Feature 2: Team Cities ─────────────────────────────────
export async function fetchTeams({ page = 1, search } = {}) {
  const params = new URLSearchParams({ page })
  if (search) params.set('search', search)
  const res = await fetch(`${API_BASE}/api/teams?${params}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Teams fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchTeamCity(slug) {
  const res = await fetch(`${API_BASE}/api/teams/${encodeURIComponent(slug)}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Team city fetch failed: ${res.status}`)
  return res.json()
}

export async function createTeam(data) {
  const res = await fetch(`${API_BASE}/api/teams`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Create team failed: ${res.status}`)
  }
  return res.json()
}

export async function addTeamMember(slug, username) {
  const res = await fetch(`${API_BASE}/api/teams/${encodeURIComponent(slug)}/members`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ username }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Add member failed: ${res.status}`)
  }
  return res.json()
}

// ─── Feature 3: Time-Travel ─────────────────────────────────
export async function fetchTimeline(username, { from, to, points } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (points) params.set('points', points)
  const res = await fetch(`${API_BASE}/api/timeline/${encodeURIComponent(username)}?${params}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Timeline fetch failed: ${res.status}`)
  return res.json()
}

// ─── Feature 5: Leaderboards ────────────────────────────────
export async function fetchLeaderboard({ category = 'commits', period, language, limit } = {}) {
  const params = new URLSearchParams({ category })
  if (period) params.set('period', period)
  if (language) params.set('language', language)
  if (limit) params.set('limit', limit)
  const res = await fetch(`${API_BASE}/api/leaderboard?${params}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Leaderboard fetch failed: ${res.status}`)
  return res.json()
}

// ─── Feature 7: Portfolio Embed ─────────────────────────────
export async function fetchEmbedData(username, opts = {}) {
  const params = new URLSearchParams()
  if (opts.theme) params.set('theme', opts.theme)
  if (opts.animate !== undefined) params.set('animate', opts.animate)
  if (opts.showLabels !== undefined) params.set('showLabels', opts.showLabels)
  const qs = params.toString()
  const res = await fetch(`${API_BASE}/api/embed/${encodeURIComponent(username)}${qs ? '?' + qs : ''}`)
  if (!res.ok) throw new Error(`Embed fetch failed: ${res.status}`)
  return res.json()
}

// ─── Upgrade 1: Real-Time Event Pipeline ─────────────────────
export async function fetchWebhookStatus() {
  const res = await fetch(`${API_BASE}/api/webhooks/status`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Webhook status fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchRecentEvents({ limit = 50, eventType, username } = {}) {
  const params = new URLSearchParams({ limit })
  if (eventType) params.set('eventType', eventType)
  if (username) params.set('username', username)
  const res = await fetch(`${API_BASE}/api/webhooks/events?${params}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`)
  return res.json()
}

// ─── Upgrade 2: Spatial Data Engine ──────────────────────────
export async function fetchSpatialTopology(usernames, { includeSpecial = true } = {}) {
  const params = new URLSearchParams({
    users: usernames.join(','),
    includeSpecial: includeSpecial.toString(),
  })
  const res = await fetch(`${API_BASE}/api/spatial/topology?${params}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Spatial topology fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchDistricts({ type, minSize } = {}) {
  const params = new URLSearchParams()
  if (type) params.set('type', type)
  if (minSize) params.set('minSize', minSize)
  const res = await fetch(`${API_BASE}/api/spatial/districts?${params}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Districts fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchUserSpatialInfo(username) {
  const res = await fetch(`${API_BASE}/api/spatial/user/${encodeURIComponent(username)}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`User spatial info fetch failed: ${res.status}`)
  return res.json()
}

// ─── Upgrade 3: City Snapshot Engine ─────────────────────────
export async function fetchSnapshots(username, { from, to, granularity = 'daily', points, limit } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (granularity) params.set('granularity', granularity)
  if (points) params.set('points', points)
  if (limit) params.set('limit', limit)
  const res = await fetch(`${API_BASE}/api/snapshots/${encodeURIComponent(username)}?${params}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Snapshots fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchLatestSnapshot(username) {
  const res = await fetch(`${API_BASE}/api/snapshots/${encodeURIComponent(username)}/latest`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Latest snapshot fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchSnapshotDelta(username, { period = 30 } = {}) {
  const params = new URLSearchParams({ period })
  const res = await fetch(`${API_BASE}/api/snapshots/${encodeURIComponent(username)}/delta?${params}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Snapshot delta fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchSnapshotEngineStatus() {
  const res = await fetch(`${API_BASE}/api/snapshots/engine/status`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Snapshot engine status fetch failed: ${res.status}`)
  return res.json()
}

/**
 * Check API health
 */
export async function checkHealth() {
  const res = await fetch(`${API_BASE}/api/health`)
  return res.json()
}
