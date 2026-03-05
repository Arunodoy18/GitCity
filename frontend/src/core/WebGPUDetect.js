import { useState, useEffect } from 'react'

/**
 * WebGPU Detection & Capability Module (Wave 5)
 *
 * Detects WebGPU availability, queries adapter info, and exposes
 * a hook for components to check GPU capabilities.
 *
 * Note: Three.js WebGPURenderer requires async init (renderer.init()),
 * which doesn't fit r3f's synchronous gl prop. This module prepares
 * for future WebGPU adoption when r3f adds native support.
 *
 * Current behavior:
 * - Detects navigator.gpu
 * - Queries adapter + device limits
 * - Reports capabilities via useWebGPU() hook
 * - Falls back to WebGL info when WebGPU unavailable
 */

/**
 * Check WebGPU support and query adapter capabilities
 * @returns {Promise<Object>} GPU capability report
 */
async function probeWebGPU() {
  const report = {
    available: false,
    backend: 'WebGL',
    adapterName: null,
    vendor: null,
    architecture: null,
    maxBufferSize: 0,
    maxTextureSize: 0,
    maxBindGroups: 0,
    supportsFloat32: false,
    supportsTimestampQuery: false,
    error: null,
  }

  if (!navigator.gpu) {
    report.error = 'WebGPU not available in this browser'
    return report
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    })

    if (!adapter) {
      report.error = 'No WebGPU adapter found'
      return report
    }

    report.available = true
    report.backend = 'WebGPU'

    // Adapter info (if available)
    if (adapter.info) {
      report.adapterName = adapter.info.device || adapter.info.description || 'Unknown'
      report.vendor = adapter.info.vendor || 'Unknown'
      report.architecture = adapter.info.architecture || 'Unknown'
    } else if (typeof adapter.requestAdapterInfo === 'function') {
      const info = await adapter.requestAdapterInfo()
      report.adapterName = info.device || info.description || 'Unknown'
      report.vendor = info.vendor || 'Unknown'
      report.architecture = info.architecture || 'Unknown'
    }

    // Device limits
    report.maxBufferSize = adapter.limits.maxBufferSize || 0
    report.maxTextureSize = adapter.limits.maxTextureDimension2D || 0
    report.maxBindGroups = adapter.limits.maxBindGroups || 0

    // Feature detection
    report.supportsFloat32 = adapter.features.has('float32-filterable')
    report.supportsTimestampQuery = adapter.features.has('timestamp-query')

  } catch (err) {
    report.error = err.message
  }

  return report
}

/**
 * React hook — returns WebGPU capability report.
 * Runs detection on mount, memoizes result.
 */
export function useWebGPU() {
  const [report, setReport] = useState({
    available: false,
    backend: 'WebGL',
    adapterName: null,
    vendor: null,
    architecture: null,
    maxBufferSize: 0,
    maxTextureSize: 0,
    maxBindGroups: 0,
    supportsFloat32: false,
    supportsTimestampQuery: false,
    error: null,
    loading: true,
  })

  useEffect(() => {
    probeWebGPU().then(r => {
      setReport({ ...r, loading: false })
    })
  }, [])

  return report
}

/**
 * Get a one-line summary string for the GPU backend
 */
export function getGPUSummary(report) {
  if (report.loading) return 'Detecting...'
  if (!report.available) return `WebGL (${report.error || 'WebGPU unavailable'})`
  return `WebGPU: ${report.vendor} ${report.adapterName} (${report.architecture})`
}
