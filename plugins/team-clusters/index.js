/**
 * Team Clusters Plugin — Group developers from the same organization
 *
 * Detects GitHub organizations and clusters their buildings into
 * distinct "districts" within the city, making team structures visible.
 *
 * @example
 * import { teamClustersPlugin } from '@gitcity/plugins/team-clusters'
 * pluginManager.registerPlugin(teamClustersPlugin)
 */

/**
 * Well-known organization color palette.
 * Used to give each org a visually distinct district tint.
 */
const ORG_COLORS = {
  google:     { r: 0.26, g: 0.52, b: 0.96 }, // Google Blue
  microsoft:  { r: 0.0,  g: 0.47, b: 0.84 }, // Microsoft Blue
  facebook:   { r: 0.23, g: 0.35, b: 0.60 }, // Meta Blue
  meta:       { r: 0.23, g: 0.35, b: 0.60 },
  apple:      { r: 0.63, g: 0.63, b: 0.63 }, // Apple Silver
  amazon:     { r: 1.0,  g: 0.60, b: 0.0  }, // Amazon Orange
  netflix:    { r: 0.89, g: 0.07, b: 0.13 }, // Netflix Red
  twitter:    { r: 0.11, g: 0.63, b: 0.95 }, // Twitter Blue
  vercel:     { r: 1.0,  g: 1.0,  b: 1.0  }, // Vercel White
  github:     { r: 0.94, g: 0.94, b: 0.94 }, // GitHub light
  mozilla:    { r: 1.0,  g: 0.32, b: 0.0  }, // Mozilla Orange
  redhat:     { r: 0.93, g: 0.11, b: 0.14 },
  shopify:    { r: 0.59, g: 0.87, b: 0.22 },
  stripe:     { r: 0.39, g: 0.35, b: 0.96 },
  cloudflare: { r: 0.96, g: 0.51, b: 0.10 },
  automattic: { r: 0.13, g: 0.59, b: 0.95 },
  hashicorp:  { r: 0.0,  g: 0.0,  b: 0.0  },
}

/**
 * Generate a deterministic color for unknown orgs.
 */
function orgHashColor(orgName) {
  let hash = 0
  for (let i = 0; i < orgName.length; i++) {
    hash = orgName.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = ((hash % 360) + 360) % 360
  // HSL to RGB approximation
  const s = 0.6, l = 0.35
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r, g, b
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  return { r: r + m, g: g + m, b: b + m }
}

export const teamClustersPlugin = {
  name: 'team-clusters',
  version: '1.0.0',
  description: 'Clusters developers from the same organization into distinct city districts',

  /** @internal Track org assignments */
  _orgRegistry: new Map(),

  /**
   * modifyBuilding — Tint buildings based on org membership.
   */
  modifyBuilding(building, metrics) {
    if (!metrics) return building

    const org = metrics.company || metrics.organization || null
    if (!org) return building

    const orgKey = org.replace(/^@/, '').toLowerCase().trim()
    if (!orgKey) return building

    // Lookup or generate org color
    const color = ORG_COLORS[orgKey] || orgHashColor(orgKey)

    // Track for district clustering
    if (!this._orgRegistry) this._orgRegistry = new Map()
    if (!this._orgRegistry.has(orgKey)) {
      this._orgRegistry.set(orgKey, { count: 0, color })
    }
    this._orgRegistry.get(orgKey).count++

    return {
      ...building,
      baseColor: {
        r: color.r * 0.5 + (building.baseColor?.r || 0.1) * 0.5,
        g: color.g * 0.5 + (building.baseColor?.g || 0.1) * 0.5,
        b: color.b * 0.5 + (building.baseColor?.b || 0.1) * 0.5,
      },
      emissive: color,
      emissiveIntensity: 0.3,
      _organization: orgKey,
      _orgColor: color,
    }
  },

  /**
   * modifyCity — Sort buildings so org members are adjacent (district clustering).
   */
  modifyCity(city, buildings) {
    if (!buildings || buildings.length === 0) return city

    // Group buildings by org
    const orgGroups = new Map()
    const ungrouped = []

    for (const b of buildings) {
      const org = b._organization
      if (org) {
        if (!orgGroups.has(org)) orgGroups.set(org, [])
        orgGroups.get(org).push(b)
      } else {
        ungrouped.push(b)
      }
    }

    // Rebuild sorted order: org clusters first, then ungrouped
    const sorted = []
    for (const [, group] of orgGroups) {
      sorted.push(...group)
    }
    sorted.push(...ungrouped)

    return {
      ...city,
      buildings: sorted,
      districts: Array.from(orgGroups.entries()).map(([org, members]) => ({
        name: org,
        size: members.length,
        color: members[0]?._orgColor,
      })),
    }
  },

  /**
   * addOverlayLayer — Provides district legend for UI rendering.
   */
  addOverlayLayer(scene, data) {
    const districts = data?.districts || []
    if (districts.length === 0) return null

    return {
      type: 'district-legend',
      position: 'top-right',
      districts: districts.slice(0, 10).map(d => ({
        name: d.name,
        members: d.size,
        color: d.color,
      })),
    }
  },
}

export default teamClustersPlugin
