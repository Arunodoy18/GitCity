/**
 * TeamCity.jsx — Feature 2: Friend/Team Cities
 *
 * Create and view shared cities for teams/groups.
 * Browse public teams, create your own, add members.
 */
import { useState, useEffect, useCallback } from 'react'
import { fetchTeams, fetchTeamCity, createTeam, addTeamMember } from '../data/api'

export default function TeamCity({ onLoadTeamUsers, active }) {
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [teamData, setTeamData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newTeam, setNewTeam] = useState({ name: '', description: '', members: '' })
  const [newMember, setNewMember] = useState('')

  const loadTeams = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchTeams({ search: search || undefined })
      setTeams(data.teams || [])
    } catch (err) {
      console.warn('Teams load failed:', err.message)
    } finally {
      setLoading(false)
    }
  }, [search])

  const loadTeamCity = useCallback(async (slug) => {
    setLoading(true)
    try {
      const data = await fetchTeamCity(slug)
      setTeamData(data)
      setSelectedTeam(slug)
      if (onLoadTeamUsers && data.members) {
        const users = data.members.map(m => ({
          username: m.username,
          commits: m.commits || 0,
          repos: m.repos || 0,
          recentActivity: m.recentActivity || false,
          topLanguage: m.topLanguage || 'JavaScript',
          stars: m.stars || 0,
          avatarUrl: m.avatarUrl || `https://github.com/${m.username}.png?size=64`,
        }))
        onLoadTeamUsers(users)
      }
    } catch (err) {
      console.warn('Team city load failed:', err.message)
    } finally {
      setLoading(false)
    }
  }, [onLoadTeamUsers])

  const handleCreate = useCallback(async () => {
    try {
      const members = newTeam.members.split(',').map(s => s.trim()).filter(Boolean)
      const data = await createTeam({ name: newTeam.name, description: newTeam.description, members })
      setShowCreate(false)
      setNewTeam({ name: '', description: '', members: '' })
      loadTeams()
      if (data.team?.slug) loadTeamCity(data.team.slug)
    } catch (err) {
      alert(err.message)
    }
  }, [newTeam, loadTeams, loadTeamCity])

  const handleAddMember = useCallback(async () => {
    if (!selectedTeam || !newMember.trim()) return
    try {
      await addTeamMember(selectedTeam, newMember.trim())
      setNewMember('')
      loadTeamCity(selectedTeam)
    } catch (err) {
      alert(err.message)
    }
  }, [selectedTeam, newMember, loadTeamCity])

  useEffect(() => {
    if (active) loadTeams()
  }, [active, loadTeams])

  if (!active) return null

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h2 style={styles.title}>👥 Team Cities</h2>
        <button onClick={() => setShowCreate(!showCreate)} style={styles.createBtn}>
          {showCreate ? '✕ Cancel' : '+ New Team'}
        </button>
      </div>

      {showCreate && (
        <div style={styles.createForm}>
          <input placeholder="Team name" value={newTeam.name}
            onChange={e => setNewTeam(p => ({ ...p, name: e.target.value }))} style={styles.input} />
          <input placeholder="Description (optional)" value={newTeam.description}
            onChange={e => setNewTeam(p => ({ ...p, description: e.target.value }))} style={styles.input} />
          <input placeholder="Members (comma-separated GitHub usernames)" value={newTeam.members}
            onChange={e => setNewTeam(p => ({ ...p, members: e.target.value }))} style={styles.input} />
          <button onClick={handleCreate} style={styles.submitBtn}>Create Team</button>
        </div>
      )}

      <div style={styles.controls}>
        <input type="text" placeholder="Search teams..." value={search}
          onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadTeams()}
          style={styles.searchInput} />
      </div>

      {loading && <div style={styles.loading}>Loading...</div>}

      {!selectedTeam ? (
        <div style={styles.teamList}>
          {teams.map(team => (
            <div key={team.slug} style={styles.teamCard} onClick={() => loadTeamCity(team.slug)}>
              <div style={styles.teamName}>{team.name}</div>
              <div style={styles.teamMeta}>
                <span>👤 {team._count?.members || '?'} members</span>
                {team.description && <span style={styles.teamDesc}>{team.description}</span>}
              </div>
            </div>
          ))}
          {teams.length === 0 && !loading && (
            <div style={styles.empty}>No teams yet. Create the first one!</div>
          )}
        </div>
      ) : (
        <div>
          <button onClick={() => { setSelectedTeam(null); setTeamData(null) }} style={styles.backBtn}>
            ← Back to teams
          </button>

          {teamData && (
            <>
              <div style={styles.teamHeader}>
                <h3 style={styles.teamTitle}>{teamData.team?.name || selectedTeam}</h3>
                {teamData.aggregate && (
                  <div style={styles.statsRow}>
                    <span>🔥 {(teamData.aggregate.totalCommits || 0).toLocaleString()} commits</span>
                    <span>⭐ {(teamData.aggregate.totalStars || 0).toLocaleString()} stars</span>
                    <span>📦 {teamData.aggregate.totalRepos || 0} repos</span>
                  </div>
                )}
              </div>

              {teamData.topLanguages && (
                <div style={styles.langBar}>
                  {teamData.topLanguages.slice(0, 6).map(([lang, count]) => (
                    <span key={lang} style={styles.langTag}>
                      {lang} ({count})
                    </span>
                  ))}
                </div>
              )}

              <div style={styles.memberList}>
                {(teamData.members || []).map(m => (
                  <div key={m.username} style={styles.memberCard}>
                    <img src={m.avatarUrl || `https://github.com/${m.username}.png?size=32`} alt="" style={styles.avatar} />
                    <div style={styles.memberInfo}>
                      <span style={styles.memberName}>{m.username}</span>
                      <span style={styles.memberLang}>{m.topLanguage || '—'}</span>
                    </div>
                    <span style={styles.memberCommits}>{(m.commits || 0).toLocaleString()} commits</span>
                  </div>
                ))}
              </div>

              <div style={styles.addMember}>
                <input placeholder="Add member username..." value={newMember}
                  onChange={e => setNewMember(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddMember()}
                  style={styles.input} />
                <button onClick={handleAddMember} style={styles.addBtn}>Add</button>
              </div>
            </>
          )}
        </div>
      )}
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  createBtn: {
    background: 'rgba(100,150,255,0.15)', border: '1px solid rgba(100,150,255,0.3)',
    borderRadius: 8, padding: '5px 12px', color: '#8ac', fontSize: 11, cursor: 'pointer',
  },
  createForm: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 },
  input: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '7px 10px', color: '#fff', fontSize: 12, outline: 'none',
  },
  submitBtn: {
    background: 'rgba(0,200,100,0.15)', border: '1px solid rgba(0,200,100,0.3)',
    borderRadius: 8, padding: '7px 14px', color: '#0c6', fontSize: 12, cursor: 'pointer',
  },
  controls: { marginBottom: 12 },
  searchInput: {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 12, outline: 'none',
  },
  loading: { textAlign: 'center', color: '#667', fontSize: 12, padding: 20 },
  teamList: { display: 'flex', flexDirection: 'column', gap: 6 },
  teamCard: {
    padding: '10px 12px', borderRadius: 10,
    background: 'rgba(255,255,255,0.03)', cursor: 'pointer',
    transition: 'background 0.15s',
  },
  teamName: { fontSize: 14, fontWeight: 600 },
  teamMeta: { fontSize: 11, color: '#667', marginTop: 2, display: 'flex', gap: 10 },
  teamDesc: { fontStyle: 'italic' },
  empty: { textAlign: 'center', color: '#556', fontSize: 12, padding: 30 },
  backBtn: {
    background: 'none', border: 'none', color: '#8ac', fontSize: 12, cursor: 'pointer',
    padding: 0, marginBottom: 10,
  },
  teamHeader: { marginBottom: 10 },
  teamTitle: { margin: 0, fontSize: 16, fontWeight: 700 },
  statsRow: { display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: '#8890a0' },
  langBar: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  langTag: {
    background: 'rgba(255,255,255,0.06)', borderRadius: 6,
    padding: '2px 8px', fontSize: 10, color: '#aab',
  },
  memberList: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 },
  memberCard: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)',
  },
  avatar: { width: 24, height: 24, borderRadius: '50%' },
  memberInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  memberName: { fontSize: 12, fontWeight: 600 },
  memberLang: { fontSize: 10, color: '#667' },
  memberCommits: { fontSize: 10, color: '#8890a0' },
  addMember: { display: 'flex', gap: 6 },
  addBtn: {
    background: 'rgba(100,150,255,0.15)', border: '1px solid rgba(100,150,255,0.3)',
    borderRadius: 8, padding: '5px 14px', color: '#8ac', fontSize: 11, cursor: 'pointer',
  },
}
