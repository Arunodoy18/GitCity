import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET || 'gitcity-fallback-secret'

/**
 * Generate a JWT for an authenticated user
 * @param {Object} user — { id, githubId, username, avatarUrl }
 * @returns {string} signed JWT token
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      githubId: user.githubId,
      username: user.username,
      avatarUrl: user.avatarUrl,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

/**
 * Verify and decode a JWT
 * @param {string} token
 * @returns {Object|null} decoded payload or null
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

/**
 * Express middleware — requires valid JWT in Authorization header or cookie.
 * Attaches `req.user` with decoded payload.
 */
export function authRequired(req, res, next) {
  const authHeader = req.headers.authorization
  let token = null

  // Check Authorization: Bearer <token>
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }

  // Check cookie fallback
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/gitcity_token=([^;]+)/)
    if (match) token = match[1]
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  req.user = decoded
  next()
}

/**
 * Express middleware — optional auth. Sets req.user if valid token, continues otherwise.
 */
export function authOptional(req, res, next) {
  const authHeader = req.headers.authorization
  let token = null

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/gitcity_token=([^;]+)/)
    if (match) token = match[1]
  }

  if (token) {
    const decoded = verifyToken(token)
    if (decoded) req.user = decoded
  }

  next()
}
