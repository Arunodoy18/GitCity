export default function ErrorToast({ message, onDismiss }) {
  if (!message) return null

  return (
    <div style={styles.container}>
      <div style={styles.toast}>
        <span style={styles.icon}>⚠</span>
        <span style={styles.message}>{message}</span>
        <button style={styles.dismiss} onClick={onDismiss}>✕</button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 400,
    animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 20px',
    background: 'rgba(255, 40, 40, 0.1)',
    border: '1px solid rgba(255, 80, 80, 0.2)',
    borderRadius: '12px',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 4px 24px rgba(255, 0, 0, 0.1), inset 0 1px 0 rgba(255,255,255,0.03)',
  },
  icon: {
    color: '#ff6666',
    fontSize: '16px',
  },
  message: {
    color: '#ffaaaa',
    fontSize: '12px',
    fontWeight: 500,
    maxWidth: '400px',
    letterSpacing: '0.3px',
  },
  dismiss: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    color: '#ff6666',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  },
}
