import { useState, useCallback } from 'react'
import { fetchUser } from './api'

/**
 * Hook for fetching GitHub user data
 * Returns { fetchUserData, loading, error }
 */
export function useGitHubUser() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchUserData = useCallback(async (username) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchUser(username)
      return data
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { fetchUserData, loading, error, clearError }
}
