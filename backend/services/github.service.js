import { cacheGet, cacheSet } from '../cache/redis.client.js'
import dotenv from 'dotenv'
dotenv.config()

const GITHUB_API = 'https://api.github.com'
const CACHE_TTL = 600 // 10 minutes

/**
 * Build headers for GitHub API requests.
 * Uses the user's OAuth access token for authenticated requests (5000 req/hr).
 * Unauthenticated requests are limited to 60 req/hr per IP.
 */
function getHeaders(accessToken = null) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GitCity-SaaS',
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }
  return headers
}

/**
 * Fetch from GitHub API with error handling
 */
async function githubFetch(url, accessToken = null) {
  const res = await fetch(url, { headers: getHeaders(accessToken) })

  const remaining = res.headers.get('x-ratelimit-remaining')
  const limit = res.headers.get('x-ratelimit-limit')
  if (remaining !== null && Number(remaining) < 100) {
    console.warn(`[GitHub API] Rate limit low: ${remaining}/${limit} remaining`)
  }

  if (res.status === 404) {
    const err = new Error('GitHub user not found')
    err.status = 404
    throw err
  }
  if (res.status === 403) {
    const err = new Error('GitHub API rate limit exceeded')
    err.status = 429
    throw err
  }
  if (!res.ok) {
    const err = new Error(`GitHub API error: ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

/**
 * Fetch complete user data from GitHub (profile + repos + events).
 * Cached in Redis for 10 minutes.
 *
 * @param {string} username
 * @param {string|null} accessToken — user's OAuth token for higher rate limits
 * @returns {Object} normalized user data for GitCity
 */
export async function fetchUserData(username, accessToken = null) {
  const cacheKey = `github:user:${username.toLowerCase()}`

  // Check cache first
  const cached = await cacheGet(cacheKey)
  if (cached) {
    console.log(`[Cache HIT] ${username}`)
    return { ...cached, cached: true }
  }

  console.log(`[Cache MISS] Fetching ${username} from GitHub...`)

  const [profile, repos, events] = await Promise.all([
    githubFetch(`${GITHUB_API}/users/${username}`, accessToken),
    githubFetch(`${GITHUB_API}/users/${username}/repos?per_page=100&sort=updated`, accessToken),
    githubFetch(`${GITHUB_API}/users/${username}/events/public?per_page=100`, accessToken),
  ])

  // Estimate commits from push events
  const pushEvents = events.filter(e => e.type === 'PushEvent')
  const recentCommits = pushEvents.reduce(
    (sum, e) => sum + (e.payload?.commits?.length || 0), 0
  )

  const accountAgeDays = Math.max(
    1,
    (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )
  const accountAgeYears = accountAgeDays / 365
  const estimatedTotalCommits = recentCommits > 0
    ? Math.round(recentCommits * accountAgeYears * 4)
    : profile.public_repos * 30

  // Recent activity check (last 7 days)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentActivity = events.some(e => new Date(e.created_at).getTime() > sevenDaysAgo)

  // Top language by star-weighted count
  const langCounts = {}
  repos.forEach(repo => {
    if (repo.language) {
      langCounts[repo.language] = (langCounts[repo.language] || 0) + (repo.stargazers_count + 1)
    }
  })
  const topLanguage = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'

  const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0)

  const result = {
    username: profile.login,
    displayName: profile.name || profile.login,
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    commits: Math.max(10, estimatedTotalCommits),
    repos: profile.public_repos,
    recentActivity,
    topLanguage,
    totalStars,
    followers: profile.followers,
    following: profile.following,
    createdAt: profile.created_at,
    profileUrl: profile.html_url,
    cached: false,
  }

  // Cache in Redis
  await cacheSet(cacheKey, result, CACHE_TTL)
  return result
}

/**
 * Fetch user's repository list (for city building)
 */
export async function fetchUserRepos(username, accessToken = null) {
  const cacheKey = `github:repos:${username.toLowerCase()}`
  const cached = await cacheGet(cacheKey)
  if (cached) return cached

  const repos = await githubFetch(
    `${GITHUB_API}/users/${username}/repos?per_page=100&sort=pushed`,
    accessToken
  )

  const result = repos.map(r => ({
    name: r.name,
    fullName: r.full_name,
    language: r.language,
    stars: r.stargazers_count,
    forks: r.forks_count,
    description: r.description,
    updatedAt: r.updated_at,
    isForked: r.fork,
  }))

  await cacheSet(cacheKey, result, CACHE_TTL)
  return result
}

/**
 * Get GitHub API rate limit status
 */
export async function getRateLimit(accessToken = null) {
  const data = await githubFetch(`${GITHUB_API}/rate_limit`, accessToken)
  return {
    limit: data.rate.limit,
    remaining: data.rate.remaining,
    resetsAt: new Date(data.rate.reset * 1000).toISOString(),
  }
}
