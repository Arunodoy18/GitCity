import { Router } from 'express'
import { fetchUserData, getRateLimit } from '../services/github.js'

const router = Router()

/**
 * GET /api/user/:username
 * Fetch GitHub user data formatted for GitCity
 */
router.get('/:username', async (req, res, next) => {
  try {
    const { username } = req.params
    if (!username || username.length < 1 || username.length > 39) {
      return res.status(400).json({ error: 'Invalid username' })
    }

    const data = await fetchUserData(username)
    res.json(data)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/user — rate limit info
 */
router.get('/', async (req, res, next) => {
  try {
    const rateLimit = await getRateLimit()
    res.json({ info: 'GitCity User API', rateLimit })
  } catch (err) {
    next(err)
  }
})

export default router
