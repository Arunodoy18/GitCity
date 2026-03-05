/**
 * districtLayout.js — Enhanced Spatial Layout Engine
 *
 * Upgrade 2: Multi-dimensional spatial intelligence with named districts.
 *
 * Supports two modes:
 *   1. Backend-driven: Consumes topology from Spatial Data Engine API
 *   2. Client-side fallback: Generates districts locally (for offline/fast startup)
 *
 * District Types:
 *   - Language neighborhoods ("TypeTown Heights", "Python Plains")
 *   - Star Spire (downtown skyscrapers for high-star users)
 *   - Neon Strip (recently active users with pulse effect)
 *   - Veteran Valley / Rookie Row (account age stratification)
 *
 * Building modifiers:
 *   - heightMultiplier: commits → building height
 *   - glowIntensity: stars → building glow
 *   - pulseRate: activity → pulsing animation
 */

// Language → color mapping for district ground tinting
export const LANGUAGE_COLORS = {
  JavaScript:  '#f1e05a',
  TypeScript:  '#3178c6',
  Python:      '#3572A5',
  Rust:        '#dea584',
  Go:          '#00ADD8',
  Java:        '#b07219',
  'C++':       '#f34b7d',
  C:           '#555555',
  Ruby:        '#701516',
  Swift:       '#F05138',
  Kotlin:      '#A97BFF',
  'C#':        '#178600',
  PHP:         '#4F5D95',
  Dart:        '#00B4AB',
  Scala:       '#c22d40',
  Elixir:      '#6e4a7e',
  Shell:       '#89e051',
  Lua:         '#000080',
  R:           '#198CE7',
  HTML:        '#e34c26',
  CSS:         '#563d7c',
  Vue:         '#41b883',
  Svelte:      '#ff3e00',
  Zig:         '#ec915c',
  Haskell:     '#5e5086',
}

// Named district themes (matching backend spatialEngine.js)
export const DISTRICT_NAMES = {
  JavaScript: 'Script Skyline',
  TypeScript: 'TypeTown Heights',
  Python: 'Python Plains',
  Rust: 'Rust Row',
  Go: 'Gopher Gardens',
  Java: 'Java Junction',
  'C++': 'C++ Citadel',
  C: 'Systems Harbor',
  Ruby: 'Ruby Ridge',
  Swift: 'Swift Summit',
  Kotlin: 'Kotlin Keep',
  'C#': 'Dotnet District',
  PHP: 'PHP Promenade',
  Dart: 'Flutter Fields',
  Scala: 'Scala Slopes',
  Elixir: 'Elixir Enclave',
  Shell: 'Terminal Terrace',
  Lua: 'Lua Lane',
  R: 'Analytics Avenue',
  HTML: 'Markup Meadows',
  CSS: 'Style Street',
  Vue: 'Vue Valley',
  Svelte: 'Svelte Strip',
  Zig: 'Zig Zone',
  Haskell: 'Lambda Loft',
}

/**
 * Apply backend spatial topology to generate positions and districts.
 * Used when the Spatial Data Engine API is available.
 *
 * @param {Object} topology — response from /api/spatial/topology
 * @returns {{ positions, districts, buildingModifiers }}
 */
export function applyServerTopology(topology) {
  if (!topology || !topology.positions) return null

  return {
    positions: topology.positions,
    districts: topology.districts.map(d => ({
      ...d,
      name: d.name,
      centroid: d.centroid,
      color: d.color || LANGUAGE_COLORS[d.language] || '#888888',
      boundingBox: d.boundingBox,
    })),
    buildingModifiers: topology.buildingModifiers || [],
  }
}

/**
 * Compute district-based positions for users (client-side fallback).
 * Enhanced with named districts, multi-factor sorting, and building modifiers.
 *
 * @param {Array} users — array of user objects with `topLanguage`
 * @returns {{ positions, districts, buildingModifiers }}
 */
export function computeDistrictPositions(users) {
  if (!users || users.length === 0) return { positions: [], districts: [], buildingModifiers: [] }

  // 1. Group users by language
  const groups = new Map()
  users.forEach((user, index) => {
    const lang = user.topLanguage || 'Other'
    if (!groups.has(lang)) groups.set(lang, [])
    groups.get(lang).push({ user, originalIndex: index })
  })

  // 2. Sort districts by composite priority:
  //    size * 0.3 + avgStars * 0.4 + avgCommits * 0.3
  const sortedDistricts = [...groups.entries()]
    .map(([lang, members]) => {
      const avgStars = members.reduce((s, m) => s + (m.user.totalStars || m.user.stars || 0), 0) / members.length
      const avgCommits = members.reduce((s, m) => s + (m.user.commits || 0), 0) / members.length
      const priority = members.length * 0.3 + avgStars * 0.4 + avgCommits * 0.3
      return { lang, members, priority, avgStars, avgCommits }
    })
    .sort((a, b) => b.priority - a.priority)

  // 3. Place districts in concentric ring layout
  const spacing = 8
  const districtGap = 20
  const positions = new Array(users.length)
  const districtMeta = []
  const buildingModifiers = new Array(users.length)

  // Compute district dimensions
  const districtPlacements = []
  for (const { lang, members, priority, avgStars, avgCommits } of sortedDistricts) {
    const cols = Math.ceil(Math.sqrt(members.length))
    const rows = Math.ceil(members.length / cols)
    const width = cols * spacing + districtGap
    const height = rows * spacing + districtGap
    districtPlacements.push({ language: lang, members, cols, rows, width, height, priority, avgStars, avgCommits })
  }

  // Place districts using spiral layout
  const placedDistricts = placeDistrictsSpiral(districtPlacements)

  for (const district of placedDistricts) {
    const { language, members, cols, cx, cz, width, height, avgStars, avgCommits } = district

    // Sort members: high stars → city center (inner positions)
    members.sort((a, b) => {
      const starsA = a.user.totalStars || a.user.stars || 0
      const starsB = b.user.totalStars || b.user.stars || 0
      return starsB - starsA
    })

    const startX = cx - (cols - 1) * spacing / 2
    const startZ = cz - (Math.ceil(members.length / cols) - 1) * spacing / 2

    for (let i = 0; i < members.length; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols

      const x = startX + col * spacing
      const z = startZ + row * spacing

      // Deterministic jitter
      const seedX = ((members[i].originalIndex * 7 + 13) % 100) / 100
      const seedZ = ((members[i].originalIndex * 11 + 17) % 100) / 100
      const jitterX = (seedX - 0.5) * 1.5
      const jitterZ = (seedZ - 0.5) * 1.5

      positions[members[i].originalIndex] = [x + jitterX, 0, z + jitterZ]

      // Building modifiers
      const user = members[i].user
      const stars = user.totalStars || user.stars || 0
      const commits = user.commits || 0
      buildingModifiers[members[i].originalIndex] = {
        heightMultiplier: Math.min(3.0, Math.max(0.3, Math.log2(commits + 1) * 0.15 + Math.log2(stars + 1) * 0.05)),
        glowIntensity: Math.min(1.0, Math.log2(stars + 1) / 15 + (user.recentActivity ? 0.3 : 0)),
        pulseRate: user.recentActivity ? 1.0 : 0,
        tint: stars >= 5000 ? '#FFD700' : null,
        label: stars >= 500 ? user.username : null,
      }
    }

    districtMeta.push({
      id: `lang-${language.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      type: 'language',
      language,
      name: DISTRICT_NAMES[language] || `${language} Quarter`,
      centroid: [cx, 0, cz],
      userCount: members.length,
      color: LANGUAGE_COLORS[language] || '#888888',
      boundingBox: {
        minX: cx - width / 2,
        maxX: cx + width / 2,
        minZ: cz - height / 2,
        maxZ: cz + height / 2,
      },
      metrics: {
        avgStars: Math.round(avgStars),
        avgCommits: Math.round(avgCommits),
        totalMembers: members.length,
      },
    })
  }

  return { positions, districts: districtMeta, buildingModifiers }
}

/**
 * Spiral placement: place districts in a spiral pattern around the origin.
 * The highest-priority district goes at center, then we spiral outward.
 */
function placeDistrictsSpiral(districts) {
  if (districts.length === 0) return []

  const result = []
  const placed = []

  for (let i = 0; i < districts.length; i++) {
    const d = districts[i]
    let cx, cz

    if (i === 0) {
      // Center
      cx = 0
      cz = 0
    } else {
      // Find a position that doesn't overlap with already-placed districts
      const angle = i * 2.399 // golden angle in radians ≈ 137.5°
      let found = false

      for (let attempt = 0; attempt < 100; attempt++) {
        const radius = 40 + attempt * 25 + Math.sqrt(d.width * d.height) * 0.5
        cx = Math.cos(angle + attempt * 0.2) * radius
        cz = Math.sin(angle + attempt * 0.2) * radius

        // Check no overlap
        if (!overlapsAny(cx, cz, d.width, d.height, placed)) {
          found = true
          break
        }
      }

      if (!found) {
        // Fallback: way out
        cx = Math.cos(angle) * (200 + i * 60)
        cz = Math.sin(angle) * (200 + i * 60)
      }
    }

    placed.push({ cx, cz, width: d.width, height: d.height })
    result.push({ ...d, cx, cz })
  }

  return result
}

function overlapsAny(cx, cz, w, h, placed) {
  const pad = 10
  for (const p of placed) {
    const overlapX = Math.abs(cx - p.cx) < (w + p.width) / 2 + pad
    const overlapZ = Math.abs(cz - p.cz) < (h + p.height) / 2 + pad
    if (overlapX && overlapZ) return true
  }
  return false
}
