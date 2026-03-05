/**
 * FeatureNav.jsx — Navigation tabs for the 7 premium features
 *
 * Sits at the top of the viewport, allowing users to switch between
 * city modes: Home, Global, Teams, Time-Travel, Live, Leaderboard, Districts.
 */

const FEATURES = [
  { id: 'home',        label: '🏙️ My City',    short: '🏙️' },
  { id: 'global',      label: '🌍 Global',      short: '🌍' },
  { id: 'teams',       label: '👥 Teams',       short: '👥' },
  { id: 'timetravel',  label: '⏳ Time-Travel', short: '⏳' },
  { id: 'live',        label: '⚡ Live',        short: '⚡' },
  { id: 'leaderboard', label: '🏆 Rankings',    short: '🏆' },
  { id: 'districts',   label: '🗺️ Districts',  short: '🗺️' },
]

export default function FeatureNav({ activeFeature, onFeatureChange }) {
  return (
    <nav style={styles.nav}>
      {FEATURES.map(f => (
        <button
          key={f.id}
          onClick={() => onFeatureChange(f.id)}
          style={{
            ...styles.tab,
            ...(activeFeature === f.id ? styles.tabActive : {}),
          }}
          title={f.label}
        >
          <span style={styles.icon}>{f.short}</span>
          <span style={styles.label}>{f.label.split(' ').slice(1).join(' ')}</span>
        </button>
      ))}
    </nav>
  )
}

const styles = {
  nav: {
    position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
    zIndex: 300, display: 'flex', gap: 3,
    background: 'rgba(10, 12, 20, 0.85)', borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(24px)', padding: 4,
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  tab: {
    background: 'transparent', border: '1px solid transparent',
    borderRadius: 10, padding: '6px 12px',
    color: '#6670a0', fontSize: 11, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', gap: 4,
    whiteSpace: 'nowrap',
  },
  tabActive: {
    background: 'rgba(100,150,255,0.12)',
    border: '1px solid rgba(100,150,255,0.25)',
    color: '#c0d0ff',
  },
  icon: { fontSize: 13 },
  label: { fontSize: 10 },
}
