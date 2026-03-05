import { useState } from 'react'

export default function SearchBar({ onSearch, userCount, loading }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query.trim() && !loading) {
      onSearch(query.trim())
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.bar}>
        {/* Brand */}
        <div style={styles.brand}>
          <span style={styles.logo}>◆</span>
          <span style={styles.title}>GitCity</span>
          <span style={styles.badge}>
            {userCount.toLocaleString()} buildings
          </span>
        </div>

        {/* Search */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search GitHub username..."
            style={{
              ...styles.input,
              borderColor: focused
                ? 'rgba(0,170,255,0.5)'
                : 'rgba(255,255,255,0.1)',
              boxShadow: focused
                ? '0 0 12px rgba(0,170,255,0.15)'
                : 'none',
            }}
            disabled={loading}
          />
          <button
            type="submit"
            style={{
              ...styles.button,
              opacity: loading ? 0.5 : 1,
            }}
            disabled={loading}
          >
            {loading ? '...' : 'FLY TO ▸'}
          </button>
        </form>

        {/* Hints */}
        <div style={styles.hints}>
          <span>🖱️ Orbit</span>
          <span>📜 Zoom</span>
          <span>🏢 Click building</span>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    pointerEvents: 'none',
    animation: 'slideDown 0.6s ease-out',
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '14px 24px',
    background: 'rgba(6, 6, 18, 0.6)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    pointerEvents: 'auto',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  logo: {
    color: '#00aaff',
    fontSize: '22px',
    filter: 'drop-shadow(0 0 6px rgba(0,170,255,0.4))',
  },
  title: {
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '3px',
    textTransform: 'uppercase',
  },
  badge: {
    background: 'rgba(0,170,255,0.1)',
    border: '1px solid rgba(0,170,255,0.2)',
    color: '#00aaff',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.5px',
  },
  form: {
    display: 'flex',
    gap: '6px',
  },
  input: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '9px 14px',
    color: '#ffffff',
    fontSize: '13px',
    width: '240px',
    outline: 'none',
    transition: 'border-color 0.3s, box-shadow 0.3s',
  },
  button: {
    background: 'linear-gradient(135deg, #00aaff, #0077cc)',
    border: 'none',
    borderRadius: '8px',
    padding: '9px 18px',
    color: '#fff',
    fontWeight: 700,
    fontSize: '11px',
    cursor: 'pointer',
    letterSpacing: '1.5px',
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 2px 10px rgba(0,170,255,0.2)',
  },
  hints: {
    display: 'flex',
    gap: '14px',
    color: 'rgba(255,255,255,0.3)',
    fontSize: '11px',
    marginLeft: 'auto',
    flexShrink: 0,
  },
}
