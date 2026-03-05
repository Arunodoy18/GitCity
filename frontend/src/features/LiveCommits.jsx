/**
 * LiveCommits.jsx — Feature 4: Live Commit Mode
 *
 * Shows a real-time feed of commits as they happen.
 * Buildings flash when their developer pushes code.
 * Activity events (stars, forks, etc.) in a sidebar feed.
 */
import { useState, useEffect, useCallback } from 'react'
import { useLiveCommits } from '../data/useLiveCommits'

export default function LiveCommits({ onFlashMap, active, trackedUsernames = [] }) {
  const {
    connected, commits, activities, stats,
    flashMap, connect, disconnect, subscribe,
  } = useLiveCommits()

  const [customUser, setCustomUser] = useState('')

  // Connect when feature is activated
  useEffect(() => {
    if (active) {
      connect()
    } else {
      disconnect()
    }
  }, [active, connect, disconnect])

  // Subscribe to tracked usernames when they change
  useEffect(() => {
    if (active && connected && trackedUsernames.length > 0) {
      subscribe(trackedUsernames)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, connected, trackedUsernames.length])

  // Forward flash map to parent for shader integration
  useEffect(() => {
    if (onFlashMap) onFlashMap(flashMap)
  }, [flashMap, onFlashMap])

  const handleAddUser = useCallback(() => {
    if (customUser.trim()) {
      subscribe(customUser.trim())
      setCustomUser('')
    }
  }, [customUser, subscribe])

  if (!active) return null

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h2 style={styles.title}>⚡ Live Commits</h2>
        <div style={{ ...styles.status, color: connected ? '#0c6' : '#f55' }}>
          {connected ? '● Connected' : '○ Disconnected'}
        </div>
      </div>

      {stats && (
        <div style={styles.statsBar}>
          <span>👤 {stats.trackedCount || 0} tracked</span>
          <span>🔌 {stats.clientCount || 0} clients</span>
        </div>
      )}

      <div style={styles.addUser}>
        <input
          placeholder="Track username..."
          value={customUser}
          onChange={e => setCustomUser(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddUser()}
          style={styles.input}
        />
        <button onClick={handleAddUser} style={styles.trackBtn}>Track</button>
      </div>

      {/* Commit feed */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🔥 Recent Commits</div>
        <div style={styles.feed}>
          {commits.length === 0 && (
            <div style={styles.empty}>Waiting for commits...</div>
          )}
          {commits.slice(0, 20).map((c, i) => (
            <div key={`${c.sha || i}-${c.timestamp}`} style={styles.commitItem}>
              <div style={styles.commitHeader}>
                <span style={styles.commitUser}>{c.username}</span>
                <span style={styles.commitTime}>
                  {c.timestamp ? new Date(c.timestamp).toLocaleTimeString() : ''}
                </span>
              </div>
              {c.commits && c.commits.length > 0 && (
                <div style={styles.commitMsg}>
                  {c.commits[0].message?.slice(0, 80) || 'push'}
                </div>
              )}
              {c.repo && <div style={styles.commitRepo}>{c.repo}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Activity feed */}
      {activities.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>📡 Activity</div>
          <div style={styles.feed}>
            {activities.slice(0, 10).map((a, i) => (
              <div key={`${a.activityType || i}-${a.timestamp}`} style={styles.activityItem}>
                <span style={styles.activityIcon}>
                  {a.activityType === 'star' ? '⭐' :
                   a.activityType === 'fork' ? '🔱' :
                   a.activityType === 'issue' ? '🐛' :
                   a.activityType === 'pr' ? '📬' :
                   a.activityType === 'create' ? '🌱' : '📌'}
                </span>
                <span style={styles.activityUser}>{a.username}</span>
                <span style={styles.activityText}>{a.text || a.activityType}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  panel: {
    position: 'absolute', top: 70, right: 20, zIndex: 200,
    width: 320, maxHeight: 'calc(100vh - 100px)',
    background: 'rgba(10, 12, 20, 0.92)', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(24px)', padding: 16,
    overflowY: 'auto', color: '#e0e0e0',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  status: { fontSize: 11, fontWeight: 600 },
  statsBar: { display: 'flex', gap: 12, fontSize: 11, color: '#667', marginBottom: 10 },
  addUser: { display: 'flex', gap: 6, marginBottom: 12 },
  input: {
    flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 12, outline: 'none',
  },
  trackBtn: {
    background: 'rgba(100,255,150,0.12)', border: '1px solid rgba(100,255,150,0.3)',
    borderRadius: 8, padding: '5px 12px', color: '#0c6', fontSize: 11, cursor: 'pointer',
  },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#8890a0', marginBottom: 6 },
  feed: { display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 250, overflowY: 'auto' },
  empty: { textAlign: 'center', color: '#445', fontSize: 11, padding: 16 },
  commitItem: {
    padding: '6px 8px', borderRadius: 8,
    background: 'rgba(255,255,255,0.02)',
    borderLeft: '2px solid rgba(100,200,255,0.3)',
  },
  commitHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  commitUser: { fontSize: 12, fontWeight: 600, color: '#8ac' },
  commitTime: { fontSize: 9, color: '#556' },
  commitMsg: { fontSize: 11, color: '#aab', marginTop: 2, fontFamily: 'monospace' },
  commitRepo: { fontSize: 9, color: '#556', marginTop: 1 },
  activityItem: { display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0' },
  activityIcon: { fontSize: 12 },
  activityUser: { fontSize: 11, fontWeight: 600, color: '#8ac' },
  activityText: { fontSize: 11, color: '#778' },
}
