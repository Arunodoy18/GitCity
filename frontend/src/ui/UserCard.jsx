export default function UserCard({ user, onClose }) {
  if (!user) return null

  const height = Math.max(1, Math.min(60, user.commits / 50))
  const isLive = !!user.profileUrl

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <button style={styles.close} onClick={onClose}>✕</button>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.avatar}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt={user.username} style={styles.avatarImg} />
              : user.username[0].toUpperCase()
            }
          </div>
          <div>
            <h2 style={styles.username}>
              {user.displayName || user.username}
              {isLive && <span style={styles.liveBadge}>LIVE</span>}
            </h2>
            <span style={styles.language}>{user.topLanguage}</span>
            {user.bio && <p style={styles.bio}>{user.bio}</p>}
          </div>
        </div>

        {/* Divider */}
        <div style={styles.divider} />

        {/* Stats */}
        <div style={styles.stats}>
          <div style={styles.stat}>
            <span style={styles.statValue}>{user.commits.toLocaleString()}</span>
            <span style={styles.statLabel}>Commits</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statValue}>{user.repos}</span>
            <span style={styles.statLabel}>Repos</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statValue}>{height.toFixed(1)}u</span>
            <span style={styles.statLabel}>Height</span>
          </div>
          {user.totalStars !== undefined && (
            <div style={styles.stat}>
              <span style={styles.statValue}>{user.totalStars.toLocaleString()}</span>
              <span style={styles.statLabel}>Stars</span>
            </div>
          )}
        </div>

        {/* Activity indicator */}
        <div style={{
          ...styles.activity,
          background: user.recentActivity
            ? 'rgba(0,255,136,0.08)'
            : 'rgba(255,68,68,0.08)',
          borderColor: user.recentActivity
            ? 'rgba(0,255,136,0.15)'
            : 'rgba(255,68,68,0.15)',
          color: user.recentActivity ? '#00ff88' : '#ff6666',
        }}>
          {user.recentActivity ? '● Active — Windows glowing' : '○ Inactive — Dark building'}
        </div>

        {user.profileUrl && (
          <a href={user.profileUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
            View on GitHub →
          </a>
        )}

        {user.cached && <span style={styles.cached}>cached</span>}
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'absolute',
    bottom: '20px',
    right: '20px',
    zIndex: 200,
    animation: 'scaleIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  card: {
    position: 'relative',
    background: 'rgba(8, 8, 24, 0.75)',
    border: '1px solid rgba(0,170,255,0.15)',
    borderRadius: '16px',
    padding: '22px',
    width: '290px',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
  },
  close: {
    position: 'absolute',
    top: '10px',
    right: '14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '50%',
    width: '26px',
    height: '26px',
    color: '#556',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s, color 0.2s',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '14px',
  },
  avatar: {
    width: '50px',
    height: '50px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #00aaff, #7700ff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '20px',
    fontWeight: 700,
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(0,100,255,0.2)',
  },
  avatarImg: {
    width: '50px',
    height: '50px',
    borderRadius: '14px',
    objectFit: 'cover',
  },
  username: {
    color: '#fff',
    fontSize: '17px',
    fontWeight: 700,
    margin: 0,
    letterSpacing: '0.3px',
  },
  language: {
    color: '#00aaff',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.5px',
  },
  bio: {
    color: '#7788aa',
    fontSize: '11px',
    margin: '4px 0 0 0',
    lineHeight: 1.4,
    maxWidth: '200px',
  },
  liveBadge: {
    marginLeft: '8px',
    background: 'rgba(0,255,136,0.12)',
    border: '1px solid rgba(0,255,136,0.2)',
    color: '#00ff88',
    padding: '2px 7px',
    borderRadius: '20px',
    fontSize: '9px',
    fontWeight: 700,
    verticalAlign: 'middle',
    letterSpacing: '0.5px',
  },
  divider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(0,170,255,0.15), transparent)',
    margin: '4px 0 14px',
  },
  stats: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '14px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  statValue: {
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
  },
  statLabel: {
    color: '#556',
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    fontWeight: 600,
  },
  activity: {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid',
    fontSize: '12px',
    fontWeight: 600,
    textAlign: 'center',
    letterSpacing: '0.3px',
  },
  link: {
    display: 'block',
    textAlign: 'center',
    marginTop: '12px',
    color: '#00aaff',
    fontSize: '12px',
    fontWeight: 600,
    textDecoration: 'none',
    letterSpacing: '0.5px',
    transition: 'color 0.2s',
  },
  cached: {
    display: 'block',
    textAlign: 'center',
    marginTop: '6px',
    color: '#445',
    fontSize: '10px',
    fontStyle: 'italic',
  },
}
