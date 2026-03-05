/**
 * TimeTravel.jsx — Feature 3: Time-Travel Mode
 *
 * A timeline slider that morphs the city buildings across years.
 * Shows how a developer's city evolved from their first commit to now.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchTimeline } from '../data/api'

export default function TimeTravel({ username, onTimelineData, active }) {
  const [timeline, setTimeline] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sliderValue, setSliderValue] = useState(100) // 0..100 maps to timeline points
  const [playing, setPlaying] = useState(false)
  const [fromYear] = useState(2015)
  const [toYear] = useState(new Date().getFullYear())

  const load = useCallback(async (user) => {
    if (!user) return
    setLoading(true)
    try {
      const data = await fetchTimeline(user, { from: fromYear, to: toYear, points: 24 })
      setTimeline(data)
      setSliderValue(100) // start at present
    } catch (err) {
      console.warn('Timeline load failed:', err.message)
    } finally {
      setLoading(false)
    }
  }, [fromYear, toYear])

  useEffect(() => {
    if (active && username) load(username)
  }, [active, username, load])

  // Auto-play animation
  useEffect(() => {
    if (!playing || !timeline) return
    const interval = setInterval(() => {
      setSliderValue(v => {
        if (v >= 100) {
          setPlaying(false)
          return 100
        }
        return v + 1
      })
    }, 120) // ~12s for full playback
    return () => clearInterval(interval)
  }, [playing, timeline])

  // Current snapshot based on slider position
  const currentSnapshot = useMemo(() => {
    if (!timeline?.timeline || timeline.timeline.length === 0) return null
    const idx = Math.round((sliderValue / 100) * (timeline.timeline.length - 1))
    return timeline.timeline[Math.min(idx, timeline.timeline.length - 1)]
  }, [timeline, sliderValue])

  // Notify parent of current state for building morphing
  useEffect(() => {
    if (currentSnapshot && onTimelineData) {
      onTimelineData(currentSnapshot)
    }
  }, [currentSnapshot, onTimelineData])

  if (!active) return null

  return (
    <div style={styles.panel}>
      <h2 style={styles.title}>⏳ Time-Travel Mode</h2>

      {!username && (
        <div style={styles.hint}>Search for a user first, then enable Time-Travel to see their city evolve.</div>
      )}

      {loading && <div style={styles.loading}>Loading timeline...</div>}

      {timeline && currentSnapshot && (
        <>
          <div style={styles.dateDisplay}>
            <span style={styles.year}>{new Date(currentSnapshot.date).getFullYear()}</span>
            <span style={styles.month}>{new Date(currentSnapshot.date).toLocaleDateString('en', { month: 'short', year: 'numeric' })}</span>
          </div>

          <div style={styles.sliderContainer}>
            <span style={styles.yearLabel}>{fromYear}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={sliderValue}
              onChange={e => setSliderValue(Number(e.target.value))}
              style={styles.slider}
            />
            <span style={styles.yearLabel}>{toYear}</span>
          </div>

          <div style={styles.controls}>
            <button onClick={() => setSliderValue(0)} style={styles.btn}>⏮</button>
            <button onClick={() => setPlaying(!playing)} style={{...styles.btn, ...styles.playBtn}}>
              {playing ? '⏸' : '▶️'}
            </button>
            <button onClick={() => setSliderValue(100)} style={styles.btn}>⏭</button>
          </div>

          <div style={styles.statsGrid}>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{(currentSnapshot.commits || 0).toLocaleString()}</div>
              <div style={styles.statLabel}>Commits</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{(currentSnapshot.stars || 0).toLocaleString()}</div>
              <div style={styles.statLabel}>Stars</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{currentSnapshot.repos || 0}</div>
              <div style={styles.statLabel}>Repos</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{currentSnapshot.followers || 0}</div>
              <div style={styles.statLabel}>Followers</div>
            </div>
          </div>

          {/* Growth percentage from start to current */}
          {timeline.timeline.length > 1 && (
            <div style={styles.growth}>
              <span style={styles.growthLabel}>Growth from {fromYear}:</span>
              {(() => {
                const first = timeline.timeline[0]
                const pct = first.commits > 0
                  ? Math.round(((currentSnapshot.commits - first.commits) / first.commits) * 100)
                  : 0
                return (
                  <span style={{ ...styles.growthValue, color: pct > 0 ? '#0c6' : '#f55' }}>
                    {pct > 0 ? '+' : ''}{pct}%
                  </span>
                )
              })()}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const styles = {
  panel: {
    position: 'absolute', top: 70, left: 20, zIndex: 200,
    width: 320, background: 'rgba(10, 12, 20, 0.92)', borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(24px)', padding: 16, color: '#e0e0e0',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  title: { margin: '0 0 12px', fontSize: 18, fontWeight: 700 },
  hint: { fontSize: 12, color: '#667', padding: 10 },
  loading: { textAlign: 'center', color: '#667', fontSize: 12, padding: 20 },
  dateDisplay: { textAlign: 'center', marginBottom: 8 },
  year: { fontSize: 32, fontWeight: 800, color: '#fff', display: 'block' },
  month: { fontSize: 12, color: '#8890a0' },
  sliderContainer: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  yearLabel: { fontSize: 10, color: '#556', minWidth: 30 },
  slider: {
    flex: 1, height: 4, appearance: 'none', background: 'rgba(255,255,255,0.1)',
    borderRadius: 4, outline: 'none', cursor: 'pointer',
  },
  controls: { display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 14 },
  btn: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '6px 16px', color: '#fff', fontSize: 14, cursor: 'pointer',
  },
  playBtn: {
    background: 'rgba(100,150,255,0.15)', border: '1px solid rgba(100,150,255,0.3)',
  },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 },
  statBox: {
    background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', textAlign: 'center',
  },
  statValue: { fontSize: 18, fontWeight: 700, color: '#fff' },
  statLabel: { fontSize: 10, color: '#667', marginTop: 2 },
  growth: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' },
  growthLabel: { fontSize: 11, color: '#667' },
  growthValue: { fontSize: 16, fontWeight: 700 },
}
