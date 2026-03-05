/**
 * @gitcity/engine — Core 3D city rendering engine
 *
 * This is the standalone engine that converts GitHub metrics into
 * 3D city geometry. It can be used independently or via the GitCity SDK.
 *
 * Exports all core modules:
 * - Layout: city grid positioning algorithms
 * - Building: metrics → visual property mapping
 * - Shaders: production-grade GLSL shaders with LOD
 * - Chunking: spatial partitioning for frustum culling
 * - Plugins: extensible plugin system
 */

export { computePositions, computePositionsRadial } from './layout.js'
export { generateBuildingProps, metricsToHeight, metricsToWidth, metricsToColor } from './building.js'
export { vertexShader, fragmentShader, createBuildingMaterial } from './shaders.js'
export { createChunks, computeBoundingSphere } from './chunking.js'
export { PluginManager, createPluginManager } from './plugins.js'

// Re-export version
export const VERSION = '1.0.0'
