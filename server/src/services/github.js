import { getCached, setCache } from './cache.js'

const GITHUB_API = 'https://api.github.com'

function getHeaders() {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GitCity-App',
  }
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  return headers
}

async function githubFetch(url) {
  const res = await fetch(url, { headers: getHeaders() })

  // Rate limit info
  const remaining = res.headers.get('x-ratelimit-remaining')
  const limit = res.headers.get('x-ratelimit-limit')
  if (remaining !== null) {
    console.log(`[GitHub API] ${remaining}/${limit} requests remaining`)
  }

  if (res.status === 404) {
    const err = new Error('GitHub user not found')
    err.status = 404
    throw err
  }

  if (res.status === 403) {
    const err = new Error('GitHub API rate limit exceeded. Try again later.')
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
 * Fetch full user profile data for GitCity
 */
export async function fetchUserData(username) {
  // Check cache first
  const cacheKey = `user:${username.toLowerCase()}`
  const cached = getCached(cacheKey)
  if (cached) {
    console.log(`[Cache HIT] ${username}`)
    return { ...cached, cached: true }
  }

  console.log(`[Cache MISS] Fetching ${username} from GitHub...`)

  // Parallel fetch: user profile + repos + recent events
  const [profile, repos, events] = await Promise.all([
    githubFetch(`${GITHUB_API}/users/${username}`),
    githubFetch(`${GITHUB_API}/users/${username}/repos?per_page=100&sort=updated`),
    githubFetch(`${GITHUB_API}/users/${username}/events/public?per_page=100`),
  ])

  // Estimate total commits from events (PushEvents in recent history)
  const pushEvents = events.filter(e => e.type === 'PushEvent')
  const recentCommits = pushEvents.reduce((sum, e) => {
    return sum + (e.payload?.commits?.length || 0)
  }, 0)

  // Estimate total commits: recent commits scaled up by account age
  const accountAgeDays = Math.max(1,
    (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )
  const accountAgeYears = accountAgeDays / 365
  // If they have recent push events, extrapolate; otherwise use repo count as proxy
  const estimatedTotalCommits = recentCommits > 0
    ? Math.round(recentCommits * accountAgeYears * 4) // rough annual extrapolation
    : profile.public_repos * 30 // fallback: ~30 commits per repo average

  // Recent activity: any events in last 7 days
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
  const recentActivity = events.some(e => new Date(e.created_at).getTime() > sevenDaysAgo)

  // Top language from repos
  const langCounts = {}
  repos.forEach(repo => {
    if (repo.language) {
      langCounts[repo.language] = (langCounts[repo.language] || 0) + (repo.stargazers_count + 1)
    }
  })
  const topLanguage = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'

  // Total stars
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

  // Cache for 10 minutes
  setCache(cacheKey, result)

  return result
}

/**
 * Get rate limit status
 */
export async function getRateLimit() {
  const data = await githubFetch(`${GITHUB_API}/rate_limit`)
  return {
    limit: data.rate.limit,
    remaining: data.rate.remaining,
    resetsAt: new Date(data.rate.reset * 1000).toISOString(),
  }
}
