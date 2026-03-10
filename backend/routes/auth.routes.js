import { Router } from 'express'
import dotenv from 'dotenv'
import prisma from '../db/prisma.js'
import { generateToken, authRequired } from '../middleware/auth.middleware.js'
import { cacheSet, cacheDel } from '../cache/redis.client.js'
import { fetchUserData } from '../services/github.service.js'
import { getOrComputeMetrics } from '../services/metrics.service.js'
import { createSnapshot } from '../services/snapshotEngine.js'

/**
 * Provision a new user's city in the background (fire-and-forget).
 * Fetches their GitHub data, computes metrics, and stores the first snapshot.
 */
async function provisionNewUserCity(user, accessToken) {
  const userData = await fetchUserData(user.username, accessToken)
  await getOrComputeMetrics(user.id, userData)
  await createSnapshot(user.id, userData, 'daily').catch(() => {})
  console.log(`[Auth] City provisioned for new user: ${user.username}`)
}

dotenv.config()

const router = Router()

const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL,
  FRONTEND_URL,
} = process.env

/**
 * GET /auth/github
 * Redirects user to GitHub OAuth authorization page
 */
router.get('/github', (req, res) => {
  const scope = 'read:user user:email'
  const url =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${GITHUB_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(GITHUB_CALLBACK_URL)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${generateState()}`

  res.redirect(url)
})

/**
 * GET /auth/github/callback
 * GitHub redirects here after user authorizes.
 * Exchanges code for access_token, fetches profile, upserts user, issues JWT.
 */
router.get('/github/callback', async (req, res) => {
  const { code, state } = req.query

  if (!code) {
    return res.redirect(`${FRONTEND_URL}?error=missing_code`)
  }

  try {
    // 1. Exchange code for access token (with 10s timeout)
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_CALLBACK_URL,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      console.error(`[OAuth] Token error: ${tokenData.error_description}`)
      return res.redirect(`${FRONTEND_URL}?error=oauth_failed`)
    }

    const accessToken = tokenData.access_token

    // 2. Fetch GitHub user profile (with 10s timeout)
    const profileRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'GitCity-SaaS',
      },
      signal: AbortSignal.timeout(10_000),
    })
    const profile = await profileRes.json()

    if (!profile.id) {
      return res.redirect(`${FRONTEND_URL}?error=profile_fetch_failed`)
    }

    // 3. Upsert user in database
    const user = await prisma.user.upsert({
      where: { githubId: profile.id },
      update: {
        username: profile.login,
        displayName: profile.name || profile.login,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
        accessToken,
      },
      create: {
        githubId: profile.id,
        username: profile.login,
        displayName: profile.name || profile.login,
        avatarUrl: profile.avatar_url,
        bio: profile.bio,
        accessToken,
      },
    })

    console.log(`[Auth] User ${user.username} (id:${user.id}) logged in`)

    // 4. Provision city for first-time sign-ups (fire-and-forget, non-blocking)
    const hasMetrics = await prisma.metric.count({ where: { userId: user.id } })
    if (hasMetrics === 0) {
      provisionNewUserCity(user, accessToken).catch(err => {
        console.warn(`[Auth] City provisioning failed for ${user.username}: ${err.message}`)
      })
    }

    // 5. Generate JWT
    const jwt = generateToken(user)

    // 6. Cache session (fire-and-forget — don't block redirect)
    cacheSet(`session:user:${user.id}`, {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      githubId: user.githubId,
    }, 7 * 24 * 3600).catch(() => {}) // 7 days

    // 7. Redirect to frontend with token + user data (avoids extra /auth/me call)
    const userData = encodeURIComponent(JSON.stringify({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    }))

    res.cookie('gitcity_token', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    res.redirect(`${FRONTEND_URL}?token=${jwt}&user=${userData}`)

  } catch (err) {
    console.error(`[OAuth] Callback error:`, err)
    res.redirect(`${FRONTEND_URL}?error=server_error`)
  }
})

/**
 * GET /auth/me
 * Returns current authenticated user profile
 */
router.get('/me', authRequired, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        githubId: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
      },
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ user })
  } catch (err) {
    console.error(`[Auth] /me error:`, err)
    res.status(500).json({ error: 'Failed to fetch user profile' })
  }
})

/**
 * POST /auth/logout
 * Clears session and cookie
 */
router.post('/logout', authRequired, async (req, res) => {
  try {
    await cacheDel(`session:user:${req.user.id}`)
  } catch { /* ignore */ }

  res.clearCookie('gitcity_token')
  res.json({ message: 'Logged out' })
})

/**
 * Generate a random state value for CSRF protection
 */
function generateState() {
  return Math.random().toString(36).substring(2, 15)
}

export default router
