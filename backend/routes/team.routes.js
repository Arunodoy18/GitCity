import { Router } from 'express'
import { authRequired, authOptional } from '../middleware/auth.middleware.js'
import { fetchUserData } from '../services/github.service.js'
import { computeMetrics } from '../services/metrics.service.js'
import { cacheGet, cacheSet } from '../cache/redis.client.js'
import prisma from '../db/prisma.js'

const router = Router()

/**
 * POST /api/teams
 * Create a new team city.
 */
router.post('/', authRequired, async (req, res, next) => {
  try {
    const { name, description, members = [], isPublic = true } = req.body

    if (!name || name.length < 2 || name.length > 50) {
      return res.status(400).json({ error: 'Team name must be 2-50 characters' })
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)

    // Check uniqueness
    const existing = await prisma.team.findUnique({ where: { slug } }).catch(() => null)
    if (existing) {
      return res.status(409).json({ error: 'Team name already taken' })
    }

    const team = await prisma.team.create({
      data: {
        slug,
        name,
        description: description || null,
        ownerId: req.user.id,
        isPublic,
        members: {
          create: [
            { userId: req.user.id, role: 'owner' },
            ...members
              .filter(m => m.userId && m.userId !== req.user.id)
              .slice(0, 49) // max 50 members
              .map(m => ({ userId: m.userId, role: m.role || 'member' })),
          ],
        },
      },
      include: { members: true },
    })

    res.status(201).json({ team })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/teams
 * List public teams + user's teams if authenticated.
 */
router.get('/', authOptional, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query
    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(50, Math.max(1, Number(limit)))
    const skip = (pageNum - 1) * limitNum

    const where = { isPublic: true }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' }
    }

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { username: true, avatarUrl: true } },
          _count: { select: { members: true } },
        },
      }),
      prisma.team.count({ where }),
    ])

    res.json({
      teams: teams.map(t => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        avatarUrl: t.avatarUrl,
        owner: t.owner,
        memberCount: t._count.members,
        createdAt: t.createdAt,
      })),
      page: pageNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/teams/:slug
 * Get a team's city data — fetches all member GitHub data.
 */
router.get('/:slug', authOptional, async (req, res, next) => {
  try {
    const { slug } = req.params
    const cacheKey = `team:city:${slug}`
    const cached = await cacheGet(cacheKey)
    if (cached) return res.json(cached)

    const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        owner: { select: { id: true, username: true, avatarUrl: true, displayName: true } },
        members: {
          include: {
            user: { select: { id: true, username: true, avatarUrl: true, displayName: true, accessToken: true } },
          },
        },
      },
    })

    if (!team) {
      return res.status(404).json({ error: 'Team not found' })
    }

    if (!team.isPublic && (!req.user || !team.members.some(m => m.userId === req.user.id))) {
      return res.status(403).json({ error: 'This team is private' })
    }

    // Fetch GitHub data for all members
    const memberData = []
    for (const member of team.members) {
      try {
        const userData = await fetchUserData(member.user.username, member.user.accessToken)
        const metrics = computeMetrics(userData)
        memberData.push({
          username: userData.username,
          displayName: userData.displayName || member.user.displayName || userData.username,
          avatarUrl: userData.avatarUrl || member.user.avatarUrl,
          role: member.role,
          joinedAt: member.joinedAt,
          topLanguage: userData.topLanguage || 'Unknown',
          commits: metrics.commits,
          repos: metrics.repos,
          stars: metrics.stars,
          followers: userData.followers || 0,
          activityScore: metrics.activityScore,
          recentActivity: userData.recentActivity || false,
        })
      } catch {
        // Include member even if fetch fails
        memberData.push({
          username: member.user.username,
          displayName: member.user.displayName || member.user.username,
          avatarUrl: member.user.avatarUrl,
          role: member.role,
          joinedAt: member.joinedAt,
          topLanguage: 'Unknown',
          commits: 0, repos: 0, stars: 0, followers: 0,
          activityScore: 0, recentActivity: false,
        })
      }
    }

    const response = {
      team: {
        id: team.id,
        slug: team.slug,
        name: team.name,
        description: team.description,
        owner: team.owner,
        memberCount: memberData.length,
        createdAt: team.createdAt,
      },
      members: memberData,
      // Aggregate team stats
      stats: {
        totalCommits: memberData.reduce((s, m) => s + m.commits, 0),
        totalStars: memberData.reduce((s, m) => s + m.stars, 0),
        totalRepos: memberData.reduce((s, m) => s + m.repos, 0),
        avgActivityScore: memberData.length > 0
          ? Math.round(memberData.reduce((s, m) => s + m.activityScore, 0) / memberData.length)
          : 0,
        topLanguages: computeTopLanguages(memberData),
      },
      timestamp: new Date().toISOString(),
    }

    await cacheSet(cacheKey, response, 600) // 10 min cache
    res.json(response)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/teams/:slug/members
 * Add members to a team by username.
 */
router.post('/:slug/members', authRequired, async (req, res, next) => {
  try {
    const { slug } = req.params
    const { usernames = [] } = req.body

    const team = await prisma.team.findUnique({
      where: { slug },
      include: { members: true },
    })

    if (!team) return res.status(404).json({ error: 'Team not found' })

    // Only owner/admin can add members
    const requester = team.members.find(m => m.userId === req.user.id)
    if (!requester || !['owner', 'admin'].includes(requester.role)) {
      return res.status(403).json({ error: 'Only team owner/admin can add members' })
    }

    if (team.members.length + usernames.length > 50) {
      return res.status(400).json({ error: 'Teams are limited to 50 members' })
    }

    const added = []
    for (const username of usernames.slice(0, 20)) {
      const user = await prisma.user.findUnique({
        where: { username: username.toLowerCase() },
      }).catch(() => null)

      if (user && !team.members.some(m => m.userId === user.id)) {
        await prisma.teamMember.create({
          data: { teamId: team.id, userId: user.id, role: 'member' },
        })
        added.push(username)
      }
    }

    res.json({ added, message: `${added.length} members added` })
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /api/teams/:slug
 * Delete a team (owner only).
 */
router.delete('/:slug', authRequired, async (req, res, next) => {
  try {
    const team = await prisma.team.findUnique({
      where: { slug: req.params.slug },
    })

    if (!team) return res.status(404).json({ error: 'Team not found' })
    if (team.ownerId !== req.user.id) return res.status(403).json({ error: 'Only the owner can delete this team' })

    await prisma.team.delete({ where: { id: team.id } })
    res.json({ message: 'Team deleted' })
  } catch (err) {
    next(err)
  }
})

/** Compute top languages from member array */
function computeTopLanguages(members) {
  const counts = {}
  for (const m of members) {
    if (m.topLanguage && m.topLanguage !== 'Unknown') {
      counts[m.topLanguage] = (counts[m.topLanguage] || 0) + 1
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))
}

export default router
