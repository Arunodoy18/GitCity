/**
 * Activity Heatmap Plugin — Building glow intensity based on commit activity
 *
 * Colors buildings with a heatmap gradient:
 *   Low activity  → cool blue glow
 *   Medium        → warm yellow glow
 *   High activity → hot red glow
 *
 * @example
 * import { activityHeatmapPlugin } from '@gitcity/plugins/activity-heatmap'
 * pluginManager.registerPlugin(activityHeatmapPlugin)
 */

/**
 * Heatmap color ramp.
 * Returns { r, g, b } in 0-1 range for a given activity score (0-1).
 */
function heatmapColor(t) {
  // clamp
  const v = Math.max(0, Math.min(1, t))

  if (v < 0.25) {
    // Deep blue → blue
    const f = v / 0.25
    return { r: 0.0, g: f * 0.2, b: 0.4 + f * 0.4 }
  }
  if (v < 0.5) {
    // Blue → green
    const f = (v - 0.25) / 0.25
    return { r: 0.0, g: 0.2 + f * 0.8, b: 0.8 * (1 - f) }
  }
  if (v < 0.75) {
    // Green → yellow
    const f = (v - 0.5) / 0.25
    return { r: f, g: 1.0, b: 0.0 }
  }
  // Yellow → red
  const f = (v - 0.75) / 0.25
  return { r: 1.0, g: 1.0 - f * 0.8, b: 0.0 }
}

/**
 * Normalize commit count to 0-1 activity score.
 * Uses logarithmic scale so differences are visible at all levels.
 */
function normalizeActivity(commits) {
  if (!commits || commits <= 0) return 0
  // log scale: 1 commit → ~0, 10000 commits → ~1
  return Math.min(1, Math.log10(commits + 1) / 4)
}

export const activityHeatmapPlugin = {
  name: 'activity-heatmap',
  version: '1.0.0',
  description: 'Colorizes buildings by commit activity using a blue→yellow→red heatmap',

  /**
   * modifyBuilding — Add heatmap glow based on commit count.
   */
  modifyBuilding(building, metrics) {
    if (!metrics) return building

    const commits = metrics.commits || metrics.estimatedTotalCommits || 0
    const score = normalizeActivity(commits)
    const glow = heatmapColor(score)

    // Glow intensity scales with activity
    const glowIntensity = 0.2 + score * 1.5

    return {
      ...building,
      emissive: glow,
      emissiveIntensity: glowIntensity,
      _heatmapScore: score,
    }
  },

  /**
   * addOverlayLayer — Provides heatmap legend data for UI rendering.
   */
  addOverlayLayer(scene, data) {
    return {
      type: 'heatmap-legend',
      position: 'bottom-left',
      labels: [
        { text: 'Low', color: '#0066cc' },
        { text: 'Medium', color: '#33cc00' },
        { text: 'High', color: '#ffcc00' },
        { text: 'Very High', color: '#ff3300' },
      ],
    }
  },
}

export default activityHeatmapPlugin
