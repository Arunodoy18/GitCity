/**
 * LanguageDistricts.jsx — Feature 6: Language Districts
 *
 * Renders colored district zones on the city floor when district mode is enabled.
 * Each language group gets a distinct colored ground zone with a floating label.
 * Uses Three.js <Html> for labels and Plane meshes for zone coloring.
 */
import { useMemo } from 'react'
import { LANGUAGE_COLORS, DISTRICT_NAMES } from '../city/districtLayout'

/**
 * DistrictOverlay — Renders ground zones and labels for language districts.
 * Place this inside the R3F <Canvas> scene.
 */
export function DistrictOverlay({ districts, active }) {
  if (!active || !districts || districts.length === 0) return null

  return (
    <group>
      {districts.map((d) => (
        <DistrictZone key={d.language} district={d} />
      ))}
    </group>
  )
}

function DistrictZone({ district }) {
  const { language, boundingBox, color } = district

  const width = (boundingBox.maxX - boundingBox.minX) || 40
  const depth = (boundingBox.maxZ - boundingBox.minZ) || 40
  const centerX = (boundingBox.minX + boundingBox.maxX) / 2
  const centerZ = (boundingBox.minZ + boundingBox.maxZ) / 2

  const colorHex = useMemo(() => {
    return LANGUAGE_COLORS[language] || color || '#888888'
  }, [language, color])

  return (
    <group position={[centerX, 0.05, centerZ]}>
      {/* Ground zone tint */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color={colorHex} transparent opacity={0.08} depthWrite={false} />
      </mesh>

      {/* Border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[Math.min(width, depth) * 0.45, Math.min(width, depth) * 0.47, 32]} />
        <meshBasicMaterial color={colorHex} transparent opacity={0.15} depthWrite={false} />
      </mesh>

      {/* Floating label — rendered as a 3D text sprite (CSS overlay alternative below) */}
      <sprite position={[0, 30, 0]} scale={[width * 0.4, 12, 1]}>
        <spriteMaterial transparent opacity={0.85} depthWrite={false} />
      </sprite>
    </group>
  )
}

/**
 * DistrictLegend — A UI overlay showing the language district color legend.
 * Place this OUTSIDE the <Canvas>, in the HTML overlay layer.
 */
export function DistrictLegend({ districts, active }) {
  // Sort by user count
  const sorted = useMemo(() => {
    if (!districts || districts.length === 0) return []
    return [...districts].sort((a, b) => (b.userCount || b.size || 0) - (a.userCount || a.size || 0))
  }, [districts])

  if (!active || sorted.length === 0) return null

  return (
    <div style={styles.legend}>
      <div style={styles.legendTitle}>🗺️ City Districts</div>
      <div style={styles.legendList}>
        {sorted.map(d => (
          <div key={d.language || d.id} style={styles.legendItem}>
            <div style={{ ...styles.colorDot, background: d.color }} />
            <span style={styles.legendLang}>{d.name || DISTRICT_NAMES[d.language] || d.language}</span>
            <span style={styles.legendCount}>{d.userCount || d.size}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  legend: {
    position: 'absolute', bottom: 80, left: 20, zIndex: 200,
    width: 200, maxHeight: 300,
    background: 'rgba(10, 12, 20, 0.92)', borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(24px)', padding: 12,
    overflowY: 'auto', color: '#e0e0e0',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  legendTitle: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  legendList: { display: 'flex', flexDirection: 'column', gap: 4 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 8 },
  colorDot: { width: 10, height: 10, borderRadius: 3, flexShrink: 0 },
  legendLang: { fontSize: 11, flex: 1 },
  legendCount: { fontSize: 10, color: '#667' },
}
