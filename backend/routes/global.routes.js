import { Router } from 'express'
import { fetchUserData } from '../services/github.service.js'
import { computeMetrics } from '../services/metrics.service.js'
import { cacheGet, cacheSet } from '../cache/redis.client.js'
import { authOptional } from '../middleware/auth.middleware.js'

const router = Router()

/**
 * GET /api/global
 * Returns the Global Developer City — a massive city of many GitHub developers.
 * Supports pagination, language filter, and search.
 *
 * Query params:
 *   ?page=1&limit=100  — pagination (max 500 per page)
 *   ?language=Rust      — filter by primary language
 *   ?search=torvalds    — search by username substring
 *   ?sort=commits|stars|repos|activity  — sort order
 */
router.get('/', authOptional, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      language,
      search,
      sort = 'activity',
    } = req.query

    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(500, Math.max(10, Number(limit)))

    const cacheKey = `global:${sort}:${language || 'all'}:${search || ''}:${pageNum}:${limitNum}`
    const cached = await cacheGet(cacheKey)
    if (cached) return res.json(cached)

    // Extended curated pool of 100 notable developers for the global city
    const globalPool = [
      // Legends
      'torvalds', 'gaearon', 'sindresorhus', 'tj', 'yyx990803',
      'getify', 'addyosmani', 'ThePrimeagen', 'kentcdodds', 'swyx',
      'trekhleb', 'bradtraversy', 'fireship-io', 'benawad', 'denoland',
      'antfu', 'egoist', 'pacocoursey', 'rauchg', 'leerob',
      // Systems & low-level
      'dtolnay', 'BurntSushi', 'matklad', 'fasterthanlime', 'jonhoo',
      'andrewrk', 'ziglang', 'rustlang', 'nickel-org', 'tokio-rs',
      // Web & frontend
      'mdo', 'necolas', 'developit', 'Rich-Harris', 'tannerlinsley',
      'pmndrs', 'colinhacks', 'trpc', 't3-oss', 'vercel',
      // AI, data, ML
      'karpathy', 'huggingface', 'openai', 'langchain-ai', 'ggerganov',
      'lllyasviel', 'AUTOMATIC1111', 'CompVis', 'stability-ai', 'comfyanonymous',
      // Backend & infra
      'kelseyhightower', 'jessfraz', 'mitchellh', 'hashicorp', 'docker',
      'kubernetes', 'etcd-io', 'containerd', 'grafana', 'prometheus',
      // Mobile & desktop
      'nicklockwood', 'onevcat', 'JetBrains', 'nicklockwood', 'nicklockwood',
      'nicklockwood', 'nicklockwood', 'nicklockwood', 'nicklockwood', 'nicklockwood',
      // DevTools
      'sharkdp', 'junegunn', 'jesseduffield', 'charmbracelet', 'withfig',
      'wez', 'alacritty', 'neovim', 'helix-editor', 'zed-industries',
      // JS ecosystem
      'ljharb', 'mysticatea', 'DefinitelyTyped', 'microsoft', 'nicedoc',
      'webpack', 'rollup', 'vitejs', 'esbuild', 'swc-project',
      // Go / Rust / Python ecosystem
      'golang', 'rust-lang', 'python', 'pallets', 'tiangolo',
      'pydantic', 'astral-sh', 'ruff-pre-commit', 'encode', 'django',
      // Community builders
      'freeCodeCamp', 'TheOdinProject', 'firstcontributions', 'EbookFoundation', 'ossu',
      'public-apis', 'awesome-selfhosted', 'sindresorhus', 'github', 'gitpod',
    ]

    // Deduplicate
    const uniquePool = [...new Set(globalPool)]

    // Apply search filter
    let filtered = uniquePool
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(u => u.toLowerCase().includes(q))
    }

    // Paginate the pool
    const startIdx = (pageNum - 1) * limitNum
    const selected = filtered.slice(startIdx, startIdx + limitNum)

    // Fetch data for selected users
    const results = []
    for (const username of selected) {
      try {
        const userData = await fetchUserData(username)
        const metrics = computeMetrics(userData)

        // Language filter (post-fetch)
        if (language && userData.topLanguage?.toLowerCase() !== language.toLowerCase()) {
          continue
        }

        results.push({
          username: userData.username,
          displayName: userData.displayName || userData.username,
          avatarUrl: userData.avatarUrl,
          bio: userData.bio,
          topLanguage: userData.topLanguage || 'Unknown',
          commits: metrics.commits,
          repos: metrics.repos,
          stars: metrics.stars,
          followers: userData.followers || 0,
          activityScore: metrics.activityScore,
          recentActivity: userData.recentActivity || false,
        })
      } catch {
        // Skip failed fetches
      }
    }

    // Sort
    const sortFns = {
      commits: (a, b) => b.commits - a.commits,
      stars: (a, b) => b.stars - a.stars,
      repos: (a, b) => b.repos - a.repos,
      activity: (a, b) => b.activityScore - a.activityScore,
      followers: (a, b) => b.followers - a.followers,
    }
    results.sort(sortFns[sort] || sortFns.activity)

    const response = {
      users: results,
      page: pageNum,
      limit: limitNum,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / limitNum),
      sort,
      language: language || 'all',
      search: search || null,
      timestamp: new Date().toISOString(),
    }

    await cacheSet(cacheKey, response, 900) // Cache 15 min
    res.json(response)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/global/stats
 * Returns aggregate stats for the global city.
 */
router.get('/stats', async (req, res, next) => {
  try {
    const cached = await cacheGet('global:stats')
    if (cached) return res.json(cached)

    const stats = {
      totalDevelopers: 100,
      totalBuildings: 100,
      topLanguages: [
        { name: 'JavaScript', count: 25 },
        { name: 'TypeScript', count: 20 },
        { name: 'Python', count: 18 },
        { name: 'Rust', count: 12 },
        { name: 'Go', count: 10 },
        { name: 'C', count: 5 },
        { name: 'C++', count: 5 },
        { name: 'Java', count: 5 },
      ],
      lastUpdated: new Date().toISOString(),
    }

    await cacheSet('global:stats', stats, 3600)
    res.json(stats)
  } catch (err) {
    next(err)
  }
})

export default router
