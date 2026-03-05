/**
 * useLiveCommits.js — WebSocket hook for live commit mode
 *
 * Connects to ws://localhost:5000/ws/live and provides:
 * - Real-time commit events (building flash triggers)
 * - Activity events (stars, forks, issues, PRs)
 * - Subscribe/unsubscribe to usernames
 * - Connection status
 */
import { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL = 'ws://localhost:5000/ws/live'

export function useLiveCommits() {
  const [connected, setConnected] = useState(false)
  const [commits, setCommits] = useState([])
  const [activities, setActivities] = useState([])
  const [stats, setStats] = useState(null)
  const [flashMap, setFlashMap] = useState(new Map()) // username → flash intensity

  const wsRef = useRef(null)
  const subscribedRef = useRef(new Set())
  const reconnectTimer = useRef(null)
  const maxCommits = 100
  const maxActivities = 50

  const connectRef = useRef(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        // Re-subscribe to any previously subscribed usernames
        if (subscribedRef.current.size > 0) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            usernames: [...subscribedRef.current],
          }))
        }
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          switch (msg.type) {
            case 'commit':
              setCommits(prev => [msg, ...prev].slice(0, maxCommits))
              // Flash the building for this user
              setFlashMap(prev => {
                const next = new Map(prev)
                next.set(msg.username, 1.0)
                return next
              })
              break

            case 'activity':
              setActivities(prev => [msg, ...prev].slice(0, maxActivities))
              break

            case 'stats':
              setStats(msg)
              break

            case 'pong':
              // heartbeat response
              break
          }
        } catch { /* ignore malformed */ }
      }

      ws.onclose = () => {
        setConnected(false)
        // Reconnect after 3s
        reconnectTimer.current = setTimeout(() => connectRef.current?.(), 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      setConnected(false)
    }
  }, [])

  // Keep ref in sync so reconnect can call latest
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current)
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
  }, [])

  const subscribe = useCallback((usernames) => {
    const names = Array.isArray(usernames) ? usernames : [usernames]
    names.forEach(n => subscribedRef.current.add(n))

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', usernames: names }))
    }
  }, [])

  const unsubscribe = useCallback((usernames) => {
    const names = Array.isArray(usernames) ? usernames : [usernames]
    names.forEach(n => subscribedRef.current.delete(n))

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', usernames: names }))
    }
  }, [])

  // Decay flash intensities every frame tick (called externally or via interval)
  useEffect(() => {
    const decay = setInterval(() => {
      setFlashMap(prev => {
        let changed = false
        const next = new Map()
        for (const [key, val] of prev) {
          const newVal = val * 0.92 // exponential decay
          if (newVal > 0.01) {
            next.set(key, newVal)
          }
          changed = true
        }
        return changed ? next : prev
      })
    }, 50) // 20fps decay

    return () => clearInterval(decay)
  }, [])

  // Ping keepalive
  useEffect(() => {
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25000)
    return () => clearInterval(ping)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(reconnectTimer.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  return {
    connected,
    commits,
    activities,
    stats,
    flashMap,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  }
}
