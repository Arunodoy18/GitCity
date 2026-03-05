/**
 * Leaderboard.jsx — Feature 5: Developer Leaderboards
 *
 * Rankings by commits, stars, repos, activity, followers.
 * Switch between categories with tabs. Filter by language.
 */
import { useState, useEffect, useCallback } from 'react'
import { fetchLeaderboard } from '../data/api'

const CATEGORIES = [
  { value: 'commits', label: '🔥 Commits', icon: '🔥' },
  { value: 'stars', label: '⭐ Stars', icon: '⭐' },
  { value: 'repos', label: '📦 Repos', icon: '📦' },
  { value: 'activity', label: '⚡ Activity', icon: '⚡' },
  { value: 'followers', label: '👥 Followers', icon: '👥' },
]

const MEDAL = ['🥇', '🥈', '🥉']

export default function Leaderboard({ onSelectUser, active }) {
  const [category, setCategory] = useState('commits')
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(false)
  const [language, setLanguage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchLeaderboard({
        category,
        language: language || undefined,
        limit: 25,
      })
      setRankings(data.rankings || [])
    } catch (err) {
      console.warn('Leaderboard load failed:', err.message)
    } finally {
      setLoading(false)
    }
  }, [category, language])

  useEffect(() => {
    if (active) load()
  }, [active, load])

  if (!active) return null

  const catObj = CATEGORIES.find(c => c.value === category) || CATEGORIES[0]

  return (
    <div style={styles.panel}>
      <h2 style={styles.title}>🏆 Leaderboard</h2>

      {/* Category tabs */}
      <div style={styles.tabs}>
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            style={{
              ...styles.tab,
              ...(category === c.value ? styles.tabActive : {}),
            }}
          >
            {c.icon}
          </button>
        ))}
      </div>

      <div style={styles.filterRow}>
        <span style={styles.filterLabel}>Filter:</span>
        <input
          placeholder="Language..."
          value={language}
          onChange={e => setLanguage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          style={styles.filterInput}
        />
      </div>

      {loading && <div style={styles.loading}>Loading rankings...</div>}

      <div style={styles.list}>
        {rankings.map((user, i) => {
          const medal = i < 3 ? MEDAL[i] : null
          const score = user[category] || user.score || 0

          return (
            <div
              key={user.username}
              style={{
                ...styles.row,
                ...(i < 3 ? styles.topRow : {}),
              }}
              onClick={() => onSelectUser?.(user.username)}
            >
              <div style={styles.rankCol}>
                {medal ? <span style={styles.medal}>{medal}</span> : <span style={styles.rankNum}>#{i + 1}</span>}
              </div>
              <img
                src={user.avatarUrl || `https://github.com/${user.username}.png?size=40`}
                alt=""
                style={styles.avatar}
              />
              <div style={styles.info}>
                <span style={styles.username}>{user.username}</span>
                <span style={styles.lang}>{user.topLanguage || ''}</span>
              </div>
              <div style={styles.score}>
                {catObj.icon} {score.toLocaleString()}
              </div>
              {/* Progress bar relative to #1 */}
              <div style={styles.barBg}>
                <div style={{
                  ...styles.barFill,
                  width: `${rankings[0] ? Math.max(5, (score / (rankings[0][category] || rankings[0].score || 1)) * 100) : 100}%`,
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  panel: {
    position: 'absolute', top: 70, left: 20, zIndex: 200,
    width: 360, maxHeight: 'calc(100vh - 100px)',
    background: 'rgba(10, 12, 20, 0.92)', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(24px)', padding: 16,
    overflowY: 'auto', color: '#e0e0e0',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  title: { margin: '0 0 10px', fontSize: 18, fontWeight: 700 },
  tabs: { display: 'flex', gap: 4, marginBottom: 10 },
  tab: {
    flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, padding: '8px 0', color: '#aab', fontSize: 16, cursor: 'pointer',
    textAlign: 'center', transition: 'all 0.15s',
  },
  tabActive: {
    background: 'rgba(100,150,255,0.15)', border: '1px solid rgba(100,150,255,0.3)',
    color: '#fff',
  },
  filterRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 },
  filterLabel: { fontSize: 11, color: '#667' },
  filterInput: {
    flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '4px 8px', color: '#fff', fontSize: 11, outline: 'none',
  },
  loading: { textAlign: 'center', color: '#667', fontSize: 12, padding: 20 },
  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  row: {
    display: 'grid', gridTemplateColumns: '32px 32px 1fr auto',
    alignItems: 'center', gap: 8,
    padding: '8px 10px', borderRadius: 10,
    background: 'rgba(255,255,255,0.02)',
    cursor: 'pointer', transition: 'background 0.15s',
    position: 'relative',
  },
  topRow: {
    background: 'rgba(255,200,50,0.04)',
    border: '1px solid rgba(255,200,50,0.08)',
  },
  rankCol: { textAlign: 'center' },
  medal: { fontSize: 18 },
  rankNum: { fontSize: 11, color: '#556', fontWeight: 700 },
  avatar: { width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' },
  info: { display: 'flex', flexDirection: 'column' },
  username: { fontSize: 13, fontWeight: 600 },
  lang: { fontSize: 10, color: '#667' },
  score: { fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' },
  barBg: {
    position: 'absolute', bottom: 2, left: 10, right: 10, height: 2,
    background: 'rgba(255,255,255,0.04)', borderRadius: 1,
  },
  barFill: {
    height: '100%', borderRadius: 1,
    background: 'linear-gradient(90deg, rgba(100,150,255,0.4), rgba(255,200,100,0.4))',
    transition: 'width 0.3s',
  },
}
