import { useState, useMemo, useCallback, useEffect, useRef } from 'react'

// Core — Scene, rendering, controls
import SceneManager from './core/SceneManager'
import RendererManager from './core/RendererManager'
import ControlManager from './core/ControlManager'

// City — Layout, buildings, floor
import CityManager from './city/CityManager'
import { computePositions } from './city/cityLayout'
import { computeDistrictPositions } from './city/districtLayout'

// UI — Overlays, panels, widgets
import SearchBar from './ui/SearchBar'
import UserCard from './ui/UserCard'
import LoadingOverlay from './ui/LoadingOverlay'
import ErrorToast from './ui/ErrorToast'
import ModeToggle from './ui/ModeToggle'
import MiniMap from './ui/MiniMap'
import { PerfOverlayInner, PerfOverlayHUD } from './ui/PerfOverlay'
import FeatureNav from './ui/FeatureNav'

// Core — WebGPU detection (Wave 5)
import { useWebGPU } from './core/WebGPUDetect'

// Data — API, hooks, mock data
import { useGitHubUser } from './data/useGitHubUser'
import { generateMockUsers, CELEBRITY_USERS } from './data/mockData'
import { useAuth } from './data/useAuth'

// UI — Auth
import AuthPanel from './ui/AuthPanel'

// Features — Premium 7
import GlobalCity from './features/GlobalCity'
import TeamCity from './features/TeamCity'
import TimeTravel from './features/TimeTravel'
import LiveCommits from './features/LiveCommits'
import Leaderboard from './features/Leaderboard'
import { DistrictOverlay, DistrictLegend } from './features/LanguageDistricts'

import './App.css'

function App() {
  // Scale to 10,000 buildings for a real city feel
  const mockUsers = useMemo(() => {
    const mock = generateMockUsers(9995)
    return [...CELEBRITY_USERS, ...mock]
  }, [])

  // Live users fetched from GitHub API
  const [liveUsers, setLiveUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [flyMode, setFlyMode] = useState(false)
  const [flyTarget, setFlyTarget] = useState(null)
  const [cameraPosition, setCameraPosition] = useState([150, 80, 150])

  // Wave 1C: Heatmap overlay toggle
  const [heatmapEnabled, setHeatmapEnabled] = useState(false)

  // Wave 1D: Day/Night cycle (0=night, 1=day) — smooth animated
  const [dayNightFactor, setDayNightFactor] = useState(0.0)
  const [dayNightAuto, setDayNightAuto] = useState(false)
  const dayNightRef = useRef(0.0)

  // Wave 4A: Performance overlay toggle
  const [perfVisible, setPerfVisible] = useState(true)
  const perfDomRef = useRef(null)

  // Wave 5: WebGPU detection
  const gpuReport = useWebGPU()

  // SaaS: Authentication
  const { user: authUser, loading: authLoading, login, logout } = useAuth()

  // ─── Premium Features State ─────────────────────────────
  const [activeFeature, setActiveFeature] = useState('home')
  const [districtMode, setDistrictMode] = useState(false)
  const [teamUsers, setTeamUsers] = useState(null) // users loaded from team city

  useEffect(() => {
    if (!dayNightAuto) return
    let frameId
    const speed = 0.08  // full cycle in ~12.5s
    const tick = () => {
      dayNightRef.current += speed / 60
      if (dayNightRef.current > 2) dayNightRef.current = 0
      // Ping-pong: 0→1→0
      const v = dayNightRef.current > 1 ? 2 - dayNightRef.current : dayNightRef.current
      setDayNightFactor(v)
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [dayNightAuto])

  const { fetchUserData, loading, error, clearError } = useGitHubUser()

  // All users = live + mock (deduped), or feature-specific users
  const allUsers = useMemo(() => {
    // If viewing team city, show only team users
    if (activeFeature === 'teams' && teamUsers) return teamUsers
    // Normal city: live + mock
    const liveUsernames = new Set(liveUsers.map(u => u.username.toLowerCase()))
    const filtered = mockUsers.filter(u => !liveUsernames.has(u.username.toLowerCase()))
    return [...liveUsers, ...filtered]
  }, [mockUsers, liveUsers, activeFeature, teamUsers])

  // District layout computation (Feature 6)
  const districtData = useMemo(() => {
    if (!districtMode || activeFeature !== 'districts') return null
    return computeDistrictPositions(allUsers)
  }, [allUsers, districtMode, activeFeature])

  // Shared position computation (used by CityManager + MiniMap + fly-target resolution)
  const positions = useMemo(() => {
    if (districtData?.positions && activeFeature === 'districts') return districtData.positions
    return computePositions(allUsers)
  }, [allUsers, districtData, activeFeature])

  // Resolve fly target to a 3D position
  const flyTargetPos = useMemo(() => {
    if (!flyTarget || !allUsers || allUsers.length === 0) return null
    const idx = allUsers.findIndex(
      (u) => u.username.toLowerCase() === flyTarget.username.toLowerCase()
    )
    if (idx >= 0 && positions[idx]) return positions[idx]
    return null
  }, [flyTarget, allUsers, positions])

  const handleSearch = useCallback(async (query) => {
    // Check if already in city (live user)
    const existing = allUsers.find((u) =>
      u.username.toLowerCase() === query.toLowerCase()
    )
    if (existing && existing.profileUrl) {
      setSelectedUser(existing)
      setFlyTarget(existing)
      return
    }

    // Fetch from GitHub API
    const data = await fetchUserData(query)
    if (data) {
      setLiveUsers(prev => {
        const exists = prev.findIndex(u => u.username.toLowerCase() === data.username.toLowerCase())
        if (exists >= 0) {
          const updated = [...prev]
          updated[exists] = data
          return updated
        }
        return [...prev, data]
      })
      setSelectedUser(data)
      // Fly to the new building after a brief delay (let it render)
      setTimeout(() => setFlyTarget(data), 100)
    }
  }, [allUsers, fetchUserData])

  const handleBuildingClick = useCallback((user) => {
    setSelectedUser(user)
  }, [])

  const handleToggleFlyMode = useCallback(() => {
    setFlyMode(prev => !prev)
  }, [])

  const handleFlyExit = useCallback(() => {
    setFlyMode(false)
  }, [])

  const handleFlyArrived = useCallback(() => {
    setFlyTarget(null)
  }, [])

  const handleCameraUpdate = useCallback((pos) => {
    setCameraPosition(pos)
  }, [])

  // Feature navigation handler
  const handleFeatureChange = useCallback((feature) => {
    setActiveFeature(feature)
    if (feature === 'districts') setDistrictMode(true)
    else setDistrictMode(false)
  }, [])

  // Track which usernames to monitor for live commits
  const trackedUsernames = useMemo(() => {
    return liveUsers.map(u => u.username).slice(0, 10)
  }, [liveUsers])

  return (
    <div className="app">
      {/* 3D Scene — composed from modular managers */}
      <SceneManager dayNightFactor={dayNightFactor}>
        <RendererManager dayNightFactor={dayNightFactor} />
        <CityManager
          users={allUsers}
          positions={positions}
          onBuildingClick={handleBuildingClick}
          heatmapEnabled={heatmapEnabled}
          dayNightFactor={dayNightFactor}
        />
        {/* Feature 6: District ground overlays */}
        <DistrictOverlay districts={districtData?.districts} active={activeFeature === 'districts'} />
        <ControlManager
          flyMode={flyMode}
          onFlyExit={handleFlyExit}
          flyTargetPos={flyTargetPos}
          onFlyArrived={handleFlyArrived}
          onCameraUpdate={handleCameraUpdate}
        />
        {perfVisible && <PerfOverlayInner targetRef={perfDomRef} />}
      </SceneManager>

      {/* Feature Navigation */}
      <FeatureNav activeFeature={activeFeature} onFeatureChange={handleFeatureChange} />

      {/* UI Overlay */}
      <AuthPanel user={authUser} loading={authLoading} onLogin={login} onLogout={logout} />
      <SearchBar
        onSearch={handleSearch}
        userCount={allUsers.length}
        loading={loading}
      />
      <ModeToggle flyMode={flyMode} onToggle={handleToggleFlyMode} />

      {/* Feature 1: Global Developer City */}
      <GlobalCity
        active={activeFeature === 'global'}
      />

      {/* Feature 2: Team Cities */}
      <TeamCity
        active={activeFeature === 'teams'}
        onLoadTeamUsers={setTeamUsers}
      />

      {/* Feature 3: Time-Travel */}
      <TimeTravel
        active={activeFeature === 'timetravel'}
        username={selectedUser?.username}
      />

      {/* Feature 4: Live Commits */}
      <LiveCommits
        active={activeFeature === 'live'}
        trackedUsernames={trackedUsernames}
      />

      {/* Feature 5: Leaderboard */}
      <Leaderboard
        active={activeFeature === 'leaderboard'}
        onSelectUser={(username) => handleSearch(username)}
      />

      {/* Feature 6: District Legend */}
      <DistrictLegend districts={districtData?.districts} active={activeFeature === 'districts'} />

      {/* Wave 1C+1D+4A controls */}
      <div style={{
        position: 'absolute', bottom: 20, right: 20, zIndex: 150,
        display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
        animation: 'slideUp 0.5s ease-out',
      }}>
        <button
          onClick={() => setHeatmapEnabled(v => !v)}
          style={{
            background: heatmapEnabled ? 'rgba(255,170,0,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${heatmapEnabled ? 'rgba(255,170,0,0.4)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 10, padding: '8px 16px',
            color: heatmapEnabled ? '#ffaa00' : '#667',
            fontWeight: 700, fontSize: 11, letterSpacing: 1.5, cursor: 'pointer',
            backdropFilter: 'blur(16px)',
            transition: 'all 0.25s',
          }}
        >
          {heatmapEnabled ? '🔥 HEATMAP ON' : '📊 HEATMAP'}
        </button>
        <button
          onClick={() => setDayNightAuto(v => !v)}
          style={{
            background: dayNightAuto ? 'rgba(255,200,50,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${dayNightAuto ? 'rgba(255,200,50,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 10, padding: '8px 16px',
            color: dayNightAuto ? '#ffcc44' : '#667',
            fontWeight: 700, fontSize: 11, letterSpacing: 1.5, cursor: 'pointer',
            backdropFilter: 'blur(16px)',
            transition: 'all 0.25s',
          }}
        >
          {dayNightAuto ? '☀️ DAY/NIGHT AUTO' : '🌙 DAY/NIGHT'}
        </button>
        <button
          onClick={() => setPerfVisible(v => !v)}
          style={{
            background: perfVisible ? 'rgba(0,255,100,0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${perfVisible ? 'rgba(0,255,100,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 10, padding: '8px 16px',
            color: perfVisible ? '#0f8' : '#667',
            fontWeight: 700, fontSize: 11, letterSpacing: 1.5, cursor: 'pointer',
            backdropFilter: 'blur(16px)',
            transition: 'all 0.25s',
          }}
        >
          {perfVisible ? '📈 PERF ON' : '📉 PERF'}
        </button>
      </div>

      <PerfOverlayHUD domRef={perfDomRef} visible={perfVisible} gpuReport={gpuReport} />

      <MiniMap
        users={allUsers}
        positions={positions}
        cameraPosition={cameraPosition}
        selectedUser={selectedUser}
      />
      {loading && <LoadingOverlay message={`Fetching from GitHub...`} />}
      <ErrorToast message={error} onDismiss={clearError} />
      <UserCard user={selectedUser} onClose={() => setSelectedUser(null)} />
    </div>
  )
}

export default App
