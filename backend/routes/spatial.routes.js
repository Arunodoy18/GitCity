import { Router } from 'express'
import { authOptional } from '../middleware/auth.middleware.js'
import { generateSpatialTopology, getSpatialTopology, getUserNeighborhood } from '../services/spatialEngine.js'
import { fetchUserData } from '../services/github.service.js'
import { cacheGet, cacheSet } from '../cache/redis.client.js'
import prisma from '../db/prisma.js'

const router = Router()

/**
 * GET /api/spatial/topology
 *
 * Generate full spatial topology for the city.
 * Accepts a list of usernames and returns district layout with positions,
 * building modifiers, and named districts.
 *
 * Query: ?users=torvalds,gaearon,sindresorhus&includeSpecial=true
 */
router.get('/topology', authOptional, async (req, res, next) => {
  try {
    const { users: usersParam, includeSpecial = 'true' } = req.query

    if (!usersParam) {
      return res.status(400).json({ error: 'Missing users parameter' })
    }

    const usernames = usersParam.split(',').map(u => u.trim()).filter(Boolean).slice(0, 200)

    if (usernames.length === 0) {
      return res.status(400).json({ error: 'No valid usernames provided' })
    }

    // Check cache first
    const cacheKey = `spatial:topo:${usernames.sort().join(',').slice(0, 200)}`
    const cached = await cacheGet(cacheKey)
    if (cached) return res.json(cached)

    // Fetch user data for all usernames (parallel with concurrency limit)
    const users = await fetchMultipleUsers(usernames)

    if (users.length === 0) {
      return res.status(404).json({ error: 'No users found' })
    }

    // Generate spatial topology
    const topology = generateSpatialTopology(users, {
      includeSpecialDistricts: includeSpecial !== 'false',
    })

    const response = {
      ...topology,
      usernames: users.map(u => u.username),
      timestamp: new Date().toISOString(),
    }

    await cacheSet(cacheKey, response, 300) // 5 min cache
    res.json(response)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/spatial/districts
 *
 * List all available districts with metadata.
 * Lighter than full topology — doesn't include positions.
 *
 * Query: ?type=language|special&minSize=5
 */
router.get('/districts', authOptional, async (req, res, next) => {
  try {
    const { type, minSize = 0 } = req.query
    const cacheKey = `spatial:districts:${type || 'all'}:${minSize}`

    const cached = await cacheGet(cacheKey)
    if (cached) return res.json(cached)

    // Get all registered users for district computation
    const dbUsers = await prisma.user.findMany({
      select: { username: true },
      take: 1000,
    }).catch(() => [])

    if (dbUsers.length === 0) {
      return res.json({ districts: [], count: 0 })
    }

    // Fetch data and generate topology
    const users = await fetchMultipleUsers(dbUsers.map(u => u.username))
    const topology = generateSpatialTopology(users)

    let districts = topology.districts
    if (type) districts = districts.filter(d => d.type === type)
    if (Number(minSize) > 0) districts = districts.filter(d => d.size >= Number(minSize))

    // Strip memberIndices for lighter response
    const response = {
      districts: districts.map(d => ({
        id: d.id,
        type: d.type,
        name: d.name,
        language: d.language,
        color: d.color,
        size: d.size,
        metrics: d.metrics,
        centroid: d.centroid,
        boundingBox: d.boundingBox,
        isOverlay: d.isOverlay || false,
        effect: d.effect || null,
      })),
      count: districts.length,
      timestamp: new Date().toISOString(),
    }

    await cacheSet(cacheKey, response, 300)
    res.json(response)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/spatial/user/:username
 *
 * Get spatial info for a single user — their district, neighbors, and modifiers.
 */
router.get('/user/:username', authOptional, async (req, res, next) => {
  try {
    const { username } = req.params
    const cacheKey = `spatial:user:${username.toLowerCase()}`

    const cached = await cacheGet(cacheKey)
    if (cached) return res.json(cached)

    // Fetch the user's data
    const userData = await fetchUserData(username)
    if (!userData) {
      return res.status(404).json({ error: 'User not found' })
    }

    // For neighborhood computation, we need some context users
    // Fetch users from the same probable language
    const lang = userData.topLanguage || 'JavaScript'
    const similarUsers = await prisma.metric.findMany({
      where: { topLanguage: lang },
      include: { user: { select: { username: true } } },
      orderBy: { activityScore: 'desc' },
      take: 50,
    }).catch(() => [])

    const contextUsernames = [
      username,
      ...similarUsers.map(m => m.user?.username).filter(Boolean),
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 50)

    const allUsers = await fetchMultipleUsers(contextUsernames)
    const neighborhood = await getUserNeighborhood(username, allUsers)

    const response = {
      ...neighborhood,
      userData: {
        username: userData.username,
        displayName: userData.displayName,
        avatarUrl: userData.avatarUrl,
        topLanguage: userData.topLanguage,
        totalStars: userData.totalStars,
        commits: userData.commits,
        repos: userData.repos,
      },
      timestamp: new Date().toISOString(),
    }

    await cacheSet(cacheKey, response, 300)
    res.json(response)
  } catch (err) {
    next(err)
  }
})

/**
 * Fetch multiple users with concurrency limiting.
 */
async function fetchMultipleUsers(usernames, concurrency = 5) {
  const results = []
  const chunks = []

  for (let i = 0; i < usernames.length; i += concurrency) {
    chunks.push(usernames.slice(i, i + concurrency))
  }

  for (const chunk of chunks) {
    const batch = await Promise.allSettled(
      chunk.map(username => fetchUserData(username).catch(() => null))
    )
    for (const result of batch) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value)
      }
    }
  }

  return results
}

export default router
