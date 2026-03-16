import { Color } from 'three'

/**
 * generateBuildingProps — Converts GitHub stats into visual properties
 *
 * @param {object} params
 * @param {number} params.commits  — total commits
 * @param {number} params.repos    — number of repos
 * @param {boolean} params.recentActivity — active in last 30 days
 * @returns {object} { height, width, depth, emissive, emissiveIntensity, baseColor }
 */
export function generateBuildingProps({ commits, repos, recentActivity }) {
  // Height = commits / 25, clamped between 2 and 80 for better visibility at city scale
  const height = Math.max(2, Math.min(80, commits / 25))

  // Width = repos * 0.5, clamped between 1 and 8
  const width = Math.max(1, Math.min(8, repos * 0.5))

  // Depth slightly varies for visual diversity (seeded from commits+repos for stability)
  const seed = ((commits * 13 + repos * 7) % 100) / 100
  const depth = Math.max(1, width * (0.6 + seed * 0.4))

  // Color based on commit count — low=blue, mid=purple, high=cyan
  const hue = (commits % 360) / 360
  const baseColor = new Color().setHSL(hue, 0.65, 0.22)

  // Active users glow
  const emissive = recentActivity
    ? new Color().setHSL(hue, 0.9, 0.4)
    : new Color('#000000')
  const emissiveIntensity = recentActivity ? 0.8 : 0

  return { height, width, depth, emissive, emissiveIntensity, baseColor }
}
