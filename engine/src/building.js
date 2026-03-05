/**
 * building.js — Converts GitHub metrics into 3D building visual properties
 *
 * These pure functions map developer stats to architectural dimensions
 * and colors. The plugin system can intercept these via modifyBuilding hooks.
 */

/**
 * Convert commit count to building height.
 * @param {number} commits
 * @param {number} [maxHeight=60]
 * @returns {number}
 */
export function metricsToHeight(commits, maxHeight = 60) {
  return Math.max(1, Math.min(maxHeight, commits / 50))
}

/**
 * Convert repo count to building width.
 * @param {number} repos
 * @param {number} [maxWidth=8]
 * @returns {number}
 */
export function metricsToWidth(repos, maxWidth = 8) {
  return Math.max(1, Math.min(maxWidth, repos * 0.5))
}

/**
 * Convert metrics to a base color (HSL).
 * Low commits → blue, mid → purple, high → cyan.
 *
 * @param {number} commits
 * @returns {{ h: number, s: number, l: number }}
 */
export function metricsToColor(commits) {
  const hue = (commits % 360) / 360
  return { h: hue, s: 0.6, l: 0.15 }
}

/**
 * Full building property generator.
 *
 * @param {object} params
 * @param {number} params.commits - Total commits
 * @param {number} params.repos - Number of repos
 * @param {boolean} params.recentActivity - Active in last 30 days
 * @param {string} [params.language] - Top language (used by plugins)
 * @returns {object} { height, width, depth, baseColor, emissive, emissiveIntensity }
 */
export function generateBuildingProps({ commits, repos, recentActivity, language }) {
  const height = metricsToHeight(commits)
  const width = metricsToWidth(repos)

  // Depth slightly varies for visual diversity
  const seed = ((commits * 13 + repos * 7) % 100) / 100
  const depth = Math.max(1, width * (0.6 + seed * 0.4))

  // Color based on commit count
  const { h: hue } = metricsToColor(commits)
  const baseColor = { r: 0, g: 0, b: 0 }

  // HSL to RGB approximation for base color
  const c = (1 - Math.abs(2 * 0.15 - 1)) * 0.6
  const x = c * (1 - Math.abs(((hue * 6) % 2) - 1))
  const m = 0.15 - c / 2
  let r1, g1, b1
  const h6 = hue * 6
  if (h6 < 1) { r1 = c; g1 = x; b1 = 0 }
  else if (h6 < 2) { r1 = x; g1 = c; b1 = 0 }
  else if (h6 < 3) { r1 = 0; g1 = c; b1 = x }
  else if (h6 < 4) { r1 = 0; g1 = x; b1 = c }
  else if (h6 < 5) { r1 = x; g1 = 0; b1 = c }
  else { r1 = c; g1 = 0; b1 = x }
  baseColor.r = r1 + m
  baseColor.g = g1 + m
  baseColor.b = b1 + m

  // Active users glow
  const emissive = recentActivity
    ? { r: baseColor.r * 2, g: baseColor.g * 2, b: baseColor.b * 2 }
    : { r: 0, g: 0, b: 0 }
  const emissiveIntensity = recentActivity ? 0.8 : 0

  return {
    height,
    width,
    depth,
    baseColor,
    emissive,
    emissiveIntensity,
    language: language || null,
  }
}
