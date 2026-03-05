import { Router } from 'express'
import { fetchUserData } from '../services/github.js'

const router = Router()

/**
 * GET /api/city?users=torvalds,gaearon,sindresorhus
 * Fetch multiple users at once for city population
 */
router.get('/', async (req, res, next) => {
  try {
    const usersParam = req.query.users
    if (!usersParam) {
      return res.status(400).json({ error: 'Provide ?users=user1,user2,...' })
    }

    const usernames = usersParam
      .split(',')
      .map(u => u.trim())
      .filter(u => u.length > 0)
      .slice(0, 20) // Max 20 users per request

    const results = await Promise.allSettled(
      usernames.map(username => fetchUserData(username))
    )

    const users = []
    const errors = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        users.push(result.value)
      } else {
        errors.push({
          username: usernames[index],
          error: result.reason.message,
        })
      }
    })

    res.json({ users, errors, total: users.length })
  } catch (err) {
    next(err)
  }
})

export default router
