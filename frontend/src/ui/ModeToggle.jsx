export default function ModeToggle({ flyMode, onToggle }) {
  return (
    <div style={styles.container}>
      <button
        style={{
          ...styles.button,
          ...(flyMode ? styles.active : {}),
        }}
        onClick={onToggle}
      >
        {flyMode ? '🎮 FLY MODE' : '🌍 ORBIT MODE'}
      </button>
      {flyMode && (
        <div style={styles.hint}>
          <div><kbd style={styles.kbd}>W</kbd><kbd style={styles.kbd}>A</kbd><kbd style={styles.kbd}>S</kbd><kbd style={styles.kbd}>D</kbd> Move</div>
          <div><kbd style={styles.kbd}>Space</kbd> Up · <kbd style={styles.kbd}>C</kbd> Down</div>
          <div><kbd style={styles.kbd}>Shift</kbd> Sprint · <kbd style={styles.kbd}>ESC</kbd> Exit</div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    position: 'absolute',
    top: '70px',
    right: '20px',
    zIndex: 150,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px',
    animation: 'fadeIn 0.5s ease-out',
  },
  button: {
    background: 'rgba(0,170,255,0.08)',
    border: '1px solid rgba(0,170,255,0.2)',
    borderRadius: '10px',
    padding: '10px 20px',
    color: '#00aaff',
    fontWeight: 700,
    fontSize: '12px',
    cursor: 'pointer',
    letterSpacing: '1.5px',
    transition: 'all 0.25s ease',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
  },
  active: {
    background: 'rgba(255,100,0,0.1)',
    borderColor: 'rgba(255,120,0,0.3)',
    color: '#ff8800',
    boxShadow: '0 2px 16px rgba(255,100,0,0.15)',
  },
  hint: {
    background: 'rgba(6,6,18,0.7)',
    borderRadius: '10px',
    padding: '12px 16px',
    color: '#667788',
    fontSize: '11px',
    lineHeight: 2,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.04)',
    animation: 'scaleIn 0.25s ease-out',
  },
  kbd: {
    display: 'inline-block',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '4px',
    padding: '1px 6px',
    margin: '0 2px',
    fontSize: '10px',
    fontFamily: 'monospace',
    color: '#99aabb',
    lineHeight: '18px',
  },
}
