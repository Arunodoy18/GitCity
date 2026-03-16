import { useFrame, useThree } from '@react-three/fiber'
import { perfManager } from '../core/PerformanceManager'

/**
 * PerfOverlay — HUD showing FPS, draw calls, triangles, and memory info.
 *
 * Uses the centralized PerformanceManager (Wave 4B) for metrics.
 * Renders stats to a DOM element via direct DOM writes (no React re-renders).
 *
 * Wave 4A: FPS + draw call counter
 * Wave 4B: Extended metrics via PerformanceManager
 */

export function PerfOverlayInner({ targetRef }) {
  const { gl } = useThree()

  useFrame((_, delta) => {
    // Use the renderer-provided frame delta to avoid timing jitter.
    perfManager.endFrame(gl, delta * 1000)

    const m = perfManager.getMetrics()

    if (targetRef.current && m.fps > 0) {
      const fpsColor = m.fps >= 55 ? '#0f0' : m.fps >= 30 ? '#ff0' : '#f44'
      targetRef.current.innerHTML = [
        `<span style="color:${fpsColor}">${m.fps} FPS</span>`,
        `<span style="color:#ff0">${m.frameTime}ms</span>`,
        `<span style="color:#0cf">▲ ${formatNum(m.triangles)}</span>`,
        `<span style="color:#f80">DC ${m.drawCalls}</span>`,
        `<span style="color:#a8a">G ${m.geometries} T ${m.textures} P ${m.programs}</span>`,
      ].join('<span style="opacity:0.3"> │ </span>')
    }
  })

  return null
}

function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

/**
 * PerfOverlayHUD — the actual DOM element for the overlay
 */
export function PerfOverlayHUD({ domRef, visible, gpuReport = null }) {
  if (!visible) return null

  const gpuLabel = gpuReport
    ? gpuReport.loading
      ? 'GPU: ...'
      : gpuReport.available
        ? `WebGPU ✓`
        : 'WebGL'
    : ''

  const gpuColor = gpuReport?.available ? '#0f8' : '#f80'

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: 16,
      zIndex: 9999,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      animation: 'fadeIn 0.5s ease',
    }}>
      <div
        ref={domRef}
        style={{
          padding: '8px 14px',
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 8,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 12,
          letterSpacing: 0.5,
          color: '#ccc',
        }}
      >
        Loading...
      </div>
      {gpuLabel && (
        <div style={{
          padding: '4px 10px',
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${gpuReport?.available ? 'rgba(0,255,136,0.15)' : 'rgba(255,136,0,0.15)'}`,
          borderRadius: 6,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 10,
          letterSpacing: 0.5,
          color: gpuColor,
        }}>
          {gpuLabel}
          {gpuReport?.adapterName && (
            <span style={{ color: '#667', marginLeft: 6 }}>
              {gpuReport.vendor} {gpuReport.adapterName}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
