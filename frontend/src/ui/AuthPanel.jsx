/**
 * AuthPanel — Login/logout + user avatar pill in the top-right.
 *
 * When logged out:  Shows "Sign in with GitHub" button
 * When logged in:   Shows avatar + username pill with dropdown (logout)
 */
import { useState } from 'react'

export default function AuthPanel({ user, loading, onLogin, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.pill, opacity: 0.5 }}>
          <div style={styles.spinner} />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={styles.container}>
        <button onClick={onLogin} style={styles.loginBtn}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: 6 }}>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          Sign in with GitHub
        </button>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <button
        onClick={() => setMenuOpen(v => !v)}
        style={styles.pill}
      >
        <img
          src={user.avatarUrl}
          alt={user.username}
          style={styles.avatar}
        />
        <span style={styles.username}>{user.username}</span>
        <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}>▼</span>
      </button>

      {menuOpen && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownInfo}>
            <span style={{ fontWeight: 600 }}>{user.displayName || user.username}</span>
            <span style={{ fontSize: 11, color: '#889' }}>@{user.username}</span>
          </div>
          <div style={styles.divider} />
          <button
            onClick={() => { setMenuOpen(false); onLogout() }}
            style={styles.logoutBtn}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 200,
    animation: 'fadeIn 0.5s ease',
  },
  loginBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 18px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    color: '#ddd',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    backdropFilter: 'blur(16px)',
    transition: 'all 0.2s',
  },
  pill: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 12px 4px 4px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    cursor: 'pointer',
    backdropFilter: 'blur(16px)',
    color: '#ddd',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    marginRight: 8,
    border: '2px solid rgba(255, 255, 255, 0.15)',
  },
  username: {
    letterSpacing: 0.3,
  },
  dropdown: {
    position: 'absolute',
    top: 44,
    right: 0,
    minWidth: 180,
    background: 'rgba(15, 15, 25, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    backdropFilter: 'blur(24px)',
    padding: '8px 0',
    animation: 'scaleIn 0.15s ease',
  },
  dropdownInfo: {
    padding: '8px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    color: '#ddd',
    fontSize: 13,
  },
  divider: {
    height: 1,
    background: 'rgba(255, 255, 255, 0.08)',
    margin: '4px 0',
  },
  logoutBtn: {
    display: 'block',
    width: '100%',
    padding: '8px 16px',
    background: 'none',
    border: 'none',
    color: '#f66',
    fontSize: 13,
    fontWeight: 500,
    textAlign: 'left',
    cursor: 'pointer',
  },
  spinner: {
    width: 20,
    height: 20,
    border: '2px solid rgba(255,255,255,0.1)',
    borderTopColor: '#0cf',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },
}
