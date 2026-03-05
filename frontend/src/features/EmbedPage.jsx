/**
 * EmbedPage.jsx — Feature 7: Portfolio Embed Mode
 *
 * A standalone, lightweight 3D city view for embedding via iframe.
 * Route: /embed/:username
 * Loads minimal city data and renders an auto-rotating city with no UI chrome.
 */
import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { fetchEmbedData } from '../data/api'
import InstancedBuildings from '../city/InstancedBuildings'
import CityFloor from '../city/CityFloor'

export default function EmbedPage() {
  const { username } = useParams()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const theme = searchParams.get('theme') || 'dark'
  const animate = searchParams.get('animate') !== 'false'
  const showLabels = searchParams.get('showLabels') !== 'false'

  useEffect(() => {
    if (!username) return
    fetchEmbedData(username, { theme, animate, showLabels })
      .then(setData)
      .catch(err => setError(err.message))
  }, [username, theme, animate, showLabels])

  // Convert embed building data into the format expected by InstancedBuildings
  const { users, positions } = useMemo(() => {
    if (!data?.buildings) return { users: [], positions: [] }

    const users = data.buildings.map(b => ({
      username: b.name || b.repo,
      commits: Math.round(b.height * 50), // reverse the height formula
      repos: Math.round(b.width / 0.5),
      recentActivity: b.height > 5,
      topLanguage: b.language || 'JavaScript',
    }))

    // Simple grid layout for embed
    const cols = Math.ceil(Math.sqrt(users.length))
    const spacing = 6
    const positions = users.map((_, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      return [(col - cols / 2) * spacing, 0, (row - cols / 2) * spacing]
    })

    return { users, positions }
  }, [data])

  if (error) {
    return (
      <div style={{
        ...containerStyle(theme),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: theme === 'dark' ? '#f55' : '#c00', fontSize: 14 }}>
          Failed to load: {error}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{
        ...containerStyle(theme),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: theme === 'dark' ? '#667' : '#999', fontSize: 14 }}>
          Loading {username}'s city...
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle(theme)}>
      <Canvas
        camera={{ position: [30, 20, 30], fov: 55 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={[theme === 'dark' ? '#0a0c14' : '#f0f2f5']} />
        <ambientLight intensity={theme === 'dark' ? 0.3 : 0.6} />
        <directionalLight position={[20, 30, 20]} intensity={theme === 'dark' ? 0.5 : 0.8} />
        <CityFloor />
        {users.length > 0 && (
          <InstancedBuildings
            users={users}
            positions={positions}
            heatmapEnabled={false}
            dayNightFactor={theme === 'dark' ? 0.0 : 1.0}
          />
        )}
        <OrbitControls
          autoRotate={animate}
          autoRotateSpeed={0.5}
          enableZoom={true}
          enablePan={false}
          maxPolarAngle={Math.PI * 0.42}
          minDistance={15}
          maxDistance={80}
        />
      </Canvas>

      {/* Watermark */}
      {showLabels && (
        <div style={styles.watermark}>
          <span style={styles.username}>{data.username}'s City</span>
          <span style={styles.stats}>
            {data.totalCommits?.toLocaleString() || '?'} commits · {data.totalStars?.toLocaleString() || '?'} stars · {data.publicRepos || '?'} repos
          </span>
          <a
            href={`https://github.com/${data.username}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            View on GitHub ↗
          </a>
        </div>
      )}

      {/* GitCity branding */}
      <div style={styles.branding}>
        🏙️ GitCity
      </div>
    </div>
  )
}

function containerStyle(theme) {
  return {
    width: '100vw', height: '100vh',
    background: theme === 'dark' ? '#0a0c14' : '#f0f2f5',
    position: 'relative', overflow: 'hidden',
  }
}

const styles = {
  watermark: {
    position: 'absolute', bottom: 16, left: 16,
    display: 'flex', flexDirection: 'column', gap: 2,
    background: 'rgba(0,0,0,0.5)', borderRadius: 10,
    padding: '8px 14px', backdropFilter: 'blur(12px)',
  },
  username: { color: '#fff', fontSize: 14, fontWeight: 700 },
  stats: { color: '#8890a0', fontSize: 11 },
  link: { color: '#6af', fontSize: 11, textDecoration: 'none' },
  branding: {
    position: 'absolute', bottom: 16, right: 16,
    color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700,
    letterSpacing: 1,
  },
}
