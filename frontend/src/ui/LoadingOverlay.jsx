export default function LoadingOverlay({ message = 'Fetching from GitHub...' }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.spinner} />
        <p style={styles.text}>{message}</p>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(3, 3, 8, 0.6)',
    zIndex: 300,
    pointerEvents: 'all',
    animation: 'fadeIn 0.3s ease-out',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
    padding: '36px 52px',
    background: 'rgba(8, 8, 24, 0.75)',
    border: '1px solid rgba(0,170,255,0.15)',
    borderRadius: '18px',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    boxShadow: '0 0 60px rgba(0,170,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
    animation: 'scaleIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '2px solid rgba(0,170,255,0.15)',
    borderTop: '2px solid #00aaff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  text: {
    color: '#7799bb',
    fontSize: '13px',
    fontWeight: 500,
    letterSpacing: '1.5px',
    animation: 'pulse 2s ease-in-out infinite',
  },
}
