/**
 * GlobalCity.jsx — Feature 1: Global Developer City
 *
 * A massive skyline of top GitHub developers worldwide.
 * Searchable, filterable by language, sortable by various metrics.
 */
import { useState, useEffect, useCallback } from 'react'
import { fetchGlobalCity, fetchGlobalStats } from '../data/api'

const SORT_OPTIONS = [
  { value: 'commits', label: '🔥 Commits' },
  { value: 'stars', label: '⭐ Stars' },
  { value: 'repos', label: '📦 Repos' },
  { value: 'followers', label: '👥 Followers' },
  { value: 'activity', label: '⚡ Activity' },
]

const LANGUAGES = [
  'All', 'JavaScript', 'TypeScript', 'Python', 'Rust', 'Go',
  'Java', 'C++', 'Ruby', 'Swift', 'Kotlin', 'C#',
]

export default function GlobalCity({ onLoadUsers, active }) {
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [search, setSearch] = useState('')
  const [language, setLanguage] = useState('All')
  const [sort, setSort] = useState('commits')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchGlobalCity({
        page, search: search || undefined,
        language: language === 'All' ? undefined : language,
        sort,
      })
      setUsers(data.users || [])
      setTotalPages(data.totalPages || 1)
      if (onLoadUsers && data.users) onLoadUsers(data.users)
    } catch (err) {
      console.warn('Global city load failed:', err.message)
    } finally {
      setLoading(false)
    }
  }, [page, search, language, sort, onLoadUsers])

  useEffect(() => {
    if (active) load()
  }, [active, load])

  useEffect(() => {
    if (active) {
      fetchGlobalStats().then(setStats).catch(() => {})
    }
  }, [active])

  if (!active) return null

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h2 style={styles.title}>🌍 Global Developer City</h2>
        {stats && (
          <div style={styles.statsRow}>
            <span style={styles.stat}>👤 {stats.totalDevelopers} devs</span>
            <span style={styles.stat}>🔥 {(stats.totalCommits || 0).toLocaleString()} commits</span>
            <span style={styles.stat}>⭐ {(stats.totalStars || 0).toLocaleString()} stars</span>
          </div>
        )}
      </div>

      <div style={styles.controls}>
        <input
          type="text"
          placeholder="Search developers..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          onKeyDown={e => e.key === 'Enter' && load()}
          style={styles.searchInput}
        />
        <select value={language} onChange={e => { setLanguage(e.target.value); setPage(1) }} style={styles.select}>
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1) }} style={styles.select}>
          {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading && <div style={styles.loading}>Loading global city...</div>}

      <div style={styles.userList}>
        {users.map((user, i) => (
          <div key={user.username} style={styles.userCard}>
            <span style={styles.rank}>#{(page - 1) * 50 + i + 1}</span>
            <img src={user.avatarUrl || `https://github.com/${user.username}.png?size=32`} alt="" style={styles.avatar} />
            <div style={styles.userInfo}>
              <span style={styles.username}>{user.username}</span>
              <span style={styles.lang}>{user.topLanguage || '—'}</span>
            </div>
            <div style={styles.metrics}>
              <span>🔥 {(user.commits || 0).toLocaleString()}</span>
              <span>⭐ {(user.stars || 0).toLocaleString()}</span>
              <span>📦 {user.repos || 0}</span>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={styles.pageBtn}>← Prev</button>
          <span style={styles.pageInfo}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={styles.pageBtn}>Next →</button>
        </div>
      )}
    </div>
  )
}

const styles = {
  panel: {
    position: 'absolute', top: 70, left: 20, zIndex: 200,
    width: 380, maxHeight: 'calc(100vh - 100px)',
    background: 'rgba(10, 12, 20, 0.92)', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(24px)', padding: 16,
    overflowY: 'auto', color: '#e0e0e0',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  header: { marginBottom: 12 },
  title: { margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: 0.5 },
  statsRow: { display: 'flex', gap: 12, marginTop: 6, fontSize: 12, color: '#8890a0' },
  stat: {},
  controls: { display: 'flex', gap: 6, marginBottom: 12 },
  searchInput: {
    flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 12, outline: 'none',
  },
  select: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '4px 8px', color: '#fff', fontSize: 11, outline: 'none',
  },
  loading: { textAlign: 'center', color: '#667', fontSize: 12, padding: 20 },
  userList: { display: 'flex', flexDirection: 'column', gap: 4 },
  userCard: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', borderRadius: 10,
    background: 'rgba(255,255,255,0.03)',
    transition: 'background 0.15s',
    cursor: 'pointer',
  },
  rank: { fontSize: 11, color: '#556', fontWeight: 700, minWidth: 28 },
  avatar: { width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' },
  userInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  username: { fontSize: 13, fontWeight: 600 },
  lang: { fontSize: 10, color: '#667' },
  metrics: { display: 'flex', gap: 8, fontSize: 10, color: '#8890a0' },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 12 },
  pageBtn: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '4px 12px', color: '#fff', fontSize: 11, cursor: 'pointer',
  },
  pageInfo: { fontSize: 11, color: '#667' },
}
