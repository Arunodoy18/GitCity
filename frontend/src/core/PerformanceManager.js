/**
 * PerformanceManager — Centralized performance metrics tracking.
 *
 * Tracks FPS, frame time, draw calls, triangles, memory estimates.
 * Singleton module — import and use from any component.
 *
 * Usage:
 *   import { perfManager } from './PerformanceManager'
 *   perfManager.beginFrame()
 *   perfManager.endFrame(gl)
 *   const metrics = perfManager.getMetrics()
 */

class PerformanceManager {
  constructor() {
    this._fps = 0
    this._frameTime = 0
    this._drawCalls = 0
    this._triangles = 0
    this._geometries = 0
    this._textures = 0
    this._programs = 0

    // Rolling averages
    this._frameTimes = new Float32Array(120) // last 120 frames
    this._frameIndex = 0
    this._frameCount = 0
    this._lastTime = performance.now()

    // Periodic snapshot for UI (avoids jitter)
    this._snapshotInterval = 500 // ms
    this._lastSnapshot = 0
    this._snapshot = this._emptySnapshot()

    // Performance warnings
    this._warnings = []
    this._lowFpsFrames = 0
  }

  _emptySnapshot() {
    return {
      fps: 0,
      frameTime: 0,
      frameTimeMin: 0,
      frameTimeMax: 0,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      programs: 0,
      warnings: [],
    }
  }

  /**
   * Call at the start of each frame (before render)
   */
  beginFrame() {
    this._frameStart = performance.now()
  }

  /**
   * Call at the end of each frame (after render)
   * @param {WebGLRenderer} gl — Three.js renderer
   */
  endFrame(gl) {
    const now = performance.now()
    const dt = now - this._frameStart

    // Store frame time
    this._frameTimes[this._frameIndex % 120] = dt
    this._frameIndex++
    this._frameCount = Math.min(this._frameIndex, 120)

    // FPS from elapsed time
    const elapsed = now - this._lastTime
    if (elapsed > 0) {
      this._fps = 1000 / elapsed
    }
    this._lastTime = now
    this._frameTime = dt

    // GPU info from renderer
    if (gl && gl.info) {
      this._drawCalls = gl.info.render.calls
      this._triangles = gl.info.render.triangles
      this._geometries = gl.info.memory?.geometries ?? 0
      this._textures = gl.info.memory?.textures ?? 0
      this._programs = gl.info.programs?.length ?? 0
    }

    // Performance warnings
    if (this._fps < 30) {
      this._lowFpsFrames++
      if (this._lowFpsFrames > 60) {
        this._addWarning('Low FPS detected (<30)')
        this._lowFpsFrames = 0
      }
    } else {
      this._lowFpsFrames = Math.max(0, this._lowFpsFrames - 1)
    }

    // Snapshot update
    if (now - this._lastSnapshot > this._snapshotInterval) {
      this._updateSnapshot()
      this._lastSnapshot = now
    }
  }

  _addWarning(msg) {
    if (this._warnings.length > 5) this._warnings.shift()
    this._warnings.push({ message: msg, time: Date.now() })
  }

  _updateSnapshot() {
    let min = Infinity
    let max = 0
    let sum = 0
    for (let i = 0; i < this._frameCount; i++) {
      const t = this._frameTimes[i]
      sum += t
      if (t < min) min = t
      if (t > max) max = t
    }
    const avg = this._frameCount > 0 ? sum / this._frameCount : 0

    this._snapshot = {
      fps: Math.round(1000 / Math.max(avg, 0.001)),
      frameTime: avg.toFixed(1),
      frameTimeMin: min === Infinity ? 0 : min.toFixed(1),
      frameTimeMax: max.toFixed(1),
      drawCalls: this._drawCalls,
      triangles: this._triangles,
      geometries: this._geometries,
      textures: this._textures,
      programs: this._programs,
      warnings: [...this._warnings],
    }
  }

  /**
   * Get the latest snapshot of performance metrics.
   * Updated every ~500ms for stable UI display.
   */
  getMetrics() {
    return this._snapshot
  }

  /**
   * Get real-time metrics (per-frame, jittery — use for graphs)
   */
  getRealtime() {
    return {
      fps: Math.round(this._fps),
      frameTime: this._frameTime,
      drawCalls: this._drawCalls,
      triangles: this._triangles,
    }
  }

  /**
   * Reset all metrics and warnings
   */
  reset() {
    this._frameTimes.fill(0)
    this._frameIndex = 0
    this._frameCount = 0
    this._warnings = []
    this._lowFpsFrames = 0
    this._snapshot = this._emptySnapshot()
  }
}

// Singleton export
export const perfManager = new PerformanceManager()
