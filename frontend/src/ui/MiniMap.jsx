import { useMemo } from 'react'

/**
 * MiniMap — Top-down 2D overview of the city
 * Shows building positions as dots, camera as a crosshair
 */
export default function MiniMap({ users, positions, cameraPosition, selectedUser }) {
  // Map dimensions
  const size = 160
  const padding = 10

  // Compute bounds
  const bounds = useMemo(() => {
    if (!positions || positions.length === 0) {
      return { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }
    }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    positions.forEach(([x, , z]) => {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    })
    const pad = 20
    return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad }
  }, [positions])

  const mapPoint = (x, z) => {
    const nx = ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (size - padding * 2) + padding
    const nz = ((z - bounds.minZ) / (bounds.maxZ - bounds.minZ)) * (size - padding * 2) + padding
    return { x: nx, y: nz }
  }

  // Camera position on map
  const camPos = cameraPosition ? mapPoint(cameraPosition[0], cameraPosition[2]) : null

  return (
    <div style={styles.container}>
      <svg width={size} height={size} style={styles.svg}>
        {/* Background */}
        <rect width={size} height={size} fill="rgba(0,0,0,0.7)" rx="8" />

        {/* Grid lines */}
        {Array.from({ length: 5 }).map((_, i) => {
          const pos = (i + 1) * (size / 6)
          return (
            <g key={i}>
              <line x1={pos} y1={0} x2={pos} y2={size} stroke="#1a2a44" strokeWidth={0.5} />
              <line x1={0} y1={pos} x2={size} y2={pos} stroke="#1a2a44" strokeWidth={0.5} />
            </g>
          )
        })}

        {/* Building dots */}
        {positions.map((pos, i) => {
          const { x, y } = mapPoint(pos[0], pos[2])
          const user = users[i]
          const isSelected = selectedUser && user && user.username === selectedUser.username
          const isActive = user?.recentActivity
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={isSelected ? 3.5 : isActive ? 2 : 1.2}
              fill={isSelected ? '#ffaa00' : isActive ? '#00aaff' : '#334466'}
              opacity={isSelected ? 1 : 0.8}
            />
          )
        })}

        {/* Camera position */}
        {camPos && (
          <g>
            <circle cx={camPos.x} cy={camPos.y} r={4} fill="none" stroke="#ff4444" strokeWidth={1.5} />
            <line x1={camPos.x - 6} y1={camPos.y} x2={camPos.x + 6} y2={camPos.y} stroke="#ff4444" strokeWidth={1} />
            <line x1={camPos.x} y1={camPos.y - 6} x2={camPos.x} y2={camPos.y + 6} stroke="#ff4444" strokeWidth={1} />
          </g>
        )}
      </svg>
      <div style={styles.label}>MINI MAP</div>
    </div>
  )
}

const styles = {
  container: {
    position: 'absolute',
    bottom: '20px',
    left: '20px',
    zIndex: 150,
    pointerEvents: 'none',
    animation: 'slideUp 0.5s ease-out',
  },
  svg: {
    borderRadius: '12px',
    border: '1px solid rgba(0,170,255,0.12)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)',
  },
  label: {
    textAlign: 'center',
    color: '#334466',
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '3px',
    marginTop: '6px',
    textTransform: 'uppercase',
  },
}
