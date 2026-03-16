import { useState, useEffect, useCallback } from 'react'
import { fetchMe, logout as apiLogout, getLoginUrl, warmBackend } from './api'

/**
 * useAuth — Authentication hook for GitCity.
 *
 * Handles:
 * - Token extraction from URL (after OAuth redirect)
 * - Token persistence in localStorage
 * - Auto-fetch user profile on mount
 * - login() / logout() actions
 *
 * Returns { user, loading, login, logout, isAuthenticated }
 */
export function useAuth() {
  // Initialise loading to false when there's no token — avoids synchronous setState in effect
  const hasToken = () => {
    const params = new URLSearchParams(window.location.search)
    return !!(params.get('token') || localStorage.getItem('gitcity_token'))
  }

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(hasToken())

  // Warm the backend in the background to reduce Render cold-start lag on sign-in.
  useEffect(() => {
    warmBackend({ timeoutMs: 5000 }).catch(() => {})
  }, [])

  // On mount: check for token in URL params (OAuth redirect) or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    const urlUser = params.get('user')

    if (urlToken) {
      // Store token from OAuth callback redirect
      localStorage.setItem('gitcity_token', urlToken)
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)

      // If user data was included in the redirect, use it directly (skip /auth/me)
      if (urlUser) {
        try {
          const userData = JSON.parse(urlUser)
          setUser(userData)
          setLoading(false)
          return
        } catch { /* fall through to fetchMe */ }
      }
    }

    // Check if we have a token and fetch user profile
    const token = localStorage.getItem('gitcity_token')
    if (token) {
      fetchMe()
        .then(userData => {
          setUser(userData)
        })
        .catch(() => {
          // Token invalid/expired — clean up
          localStorage.removeItem('gitcity_token')
          setUser(null)
        })
        .finally(() => setLoading(false))
    }
  }, [])

  const login = useCallback(async () => {
    // Best-effort warmup before navigating away to OAuth.
    await warmBackend({ timeoutMs: 12000 }).catch(() => {})
    window.location.href = getLoginUrl()
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
  }, [])

  return {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  }
}
