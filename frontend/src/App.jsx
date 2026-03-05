import { useState, useMemo, useCallback, useEffect, useRef } from 'react'

// Landing page
import LandingPage from './landing/LandingPage'

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
  // Landing page state — show for non-authenticated visitors
  const [showLanding, setShowLanding] = useState(() => {
    return !localStorage.getItem('gitcity_token') && !localStorage.getItem('gitcity_explored')
  })

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

  // Personal city mode: when logged in, show only the user's own building initially
  const [personalCity, setPersonalCity] = useState(true)

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

  // Hide landing once authenticated
  useEffect(() => {
    if (authUser) setShowLanding(false)
  }, [authUser])

  // Landing page callbacks
  const handleEnterCity = useCallback(() => {
    localStorage.setItem('gitcity_explored', '1')
    setShowLanding(false)
  }, [])

  const handleLandingLogin = useCallback(() => {
    login()
  }, [login])

  // Auto-fetch authenticated user's GitHub data on login
  const [authCityLoading, setAuthCityLoading] = useState(false)
  useEffect(() => {
    if (!authUser?.username) return
    // Already fetched
    if (liveUsers.some(u => u.username.toLowerCase() === authUser.username.toLowerCase())) return

    setAuthCityLoading(true)
    fetchUserData(authUser.username).then(data => {
      if (data) {
        setLiveUsers(prev => {
          if (prev.some(u => u.username.toLowerCase() === data.username.toLowerCase())) return prev
          return [data, ...prev]
        })
        setSelectedUser(data)
        setPersonalCity(true)
      }
    }).finally(() => setAuthCityLoading(false))
  }, [authUser?.username]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to personal city on logout
  useEffect(() => {
    if (!authUser) setPersonalCity(false)
  }, [authUser])

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

    // Personal city: show only the authenticated user's building
    if (personalCity && authUser) {
      const authBuilding = liveUsers.find(
        u => u.username.toLowerCase() === authUser.username.toLowerCase()
      )
      if (authBuilding) return [authBuilding]
    }

    // Full city: live + mock
    const liveUsernames = new Set(liveUsers.map(u => u.username.toLowerCase()))
    const filtered = mockUsers.filter(u => !liveUsernames.has(u.username.toLowerCase()))
    return [...liveUsers, ...filtered]
  }, [mockUsers, liveUsers, activeFeature, teamUsers, personalCity, authUser])

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

  // ─── LANDING PAGE ─────────────────────────────────────────
  if (showLanding) {
    return <LandingPage onEnter={handleEnterCity} onLogin={handleLandingLogin} />
  }

  const kbdStyle = {
    display: 'inline-block', padding: '2px 7px', background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4,
    color: '#8cf', fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
  }

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

      {/* Fly mode HUD */}
      {flyMode && (
        <div style={{
          position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, display: 'flex', gap: 16, alignItems: 'center',
          padding: '10px 20px', background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(100,200,255,0.15)', borderRadius: 12,
          backdropFilter: 'blur(12px)', animation: 'fadeIn 0.4s ease',
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ display: 'flex', gap: 3 }}>
              <kbd style={kbdStyle}>W</kbd>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              <kbd style={kbdStyle}>A</kbd>
              <kbd style={kbdStyle}>S</kbd>
              <kbd style={kbdStyle}>D</kbd>
            </div>
          </div>
          <span style={{ color: '#556', fontSize: 11 }}>Move</span>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ color: '#556', fontSize: 11 }}>
            <kbd style={kbdStyle}>Space</kbd> Up &nbsp; <kbd style={kbdStyle}>C</kbd> Down &nbsp; <kbd style={kbdStyle}>Shift</kbd> Sprint
          </span>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ color: '#667', fontSize: 11 }}>Click to look · <kbd style={kbdStyle}>Esc</kbd> exit</span>
        </div>
      )}

      {/* UI Overlay */}
      <AuthPanel user={authUser} loading={authLoading} onLogin={login} onLogout={logout} />

      {/* Personal city banner — shown when logged in user sees only their building */}
      {personalCity && authUser && !authCityLoading && (
        <div style={{
          position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
          zIndex: 180, display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 20px', background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(100,200,255,0.2)', borderRadius: 12,
          backdropFilter: 'blur(16px)', animation: 'fadeIn 0.5s ease',
        }}>
          <span style={{ color: '#aad', fontSize: 13, fontWeight: 500 }}>
            🏠 Your City
          </span>
          <button
            onClick={() => setPersonalCity(false)}
            style={{
              padding: '6px 14px', background: 'rgba(100,200,255,0.12)',
              border: '1px solid rgba(100,200,255,0.3)', borderRadius: 8,
              color: '#8cf', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Explore Full City →
          </button>
        </div>
      )}
      {authCityLoading && <LoadingOverlay message="Loading your city..." />}
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
