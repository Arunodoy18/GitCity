import { cacheGet, cacheSet } from '../cache/redis.client.js'
import prisma from '../db/prisma.js'
import { computeMetrics } from './metrics.service.js'

/**
 * GitCity Spatial Data Engine — Multi-Dimensional District Generation
 *
 * Architecture:
 *   User Data → Spatial Analysis → District Assignment → Topology Generation → 3D Positioning
 *
 * District Types (5 dimensions):
 *
 *   1. Language Neighborhoods — grouped by primary coding language
 *      "TypeScript Terrace", "Python Plains", "Rust Row", etc.
 *
 *   2. Star District (Downtown) — highest-star repos get prime center positions
 *      Users with >1000 stars → downtown skyscrapers
 *
 *   3. Activity Zones — buildings pulse/glow based on recent activity
 *      "Neon Strip" = most active in last 7 days
 *      "Quiet Quarter" = dormant accounts
 *
 *   4. Corporate Campuses — organization-based clusters
 *      Users from same org → adjacent buildings
 *
 *   5. Rookie Row vs Veteran Valley — account age stratification
 *      New accounts (<1 year) → outskirts
 *      Veterans (>5 years) → established core
 *
 * Named Districts:
 *   Each generated district gets a thematic name based on its
 *   characteristics ("Silicon Spire", "Data Delta", "Systems Harbor").
 *
 * The engine outputs a complete spatial topology that the frontend
 * uses for 3D layout, including positions, district boundaries,
 * color palettes, and building modifiers (height, glow, pulse).
 */

// ─── Named District Themes ──────────────────────────────────

const LANGUAGE_DISTRICT_NAMES = {
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

const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  'C#': '#178600',
  PHP: '#4F5D95',
  Dart: '#00B4AB',
  Scala: '#c22d40',
  Elixir: '#6e4a7e',
  Shell: '#89e051',
  Lua: '#000080',
  R: '#198CE7',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Zig: '#ec915c',
  Haskell: '#5e5086',
}

const SPECIAL_DISTRICT_NAMES = {
  downtown: 'Star Spire',     // High-star users → city center
  neonStrip: 'Neon Strip',     // Most recently active
  rookieRow: 'Rookie Row',     // New accounts
  veteranCore: 'Veteran Valley', // Old established accounts
  dormant: 'Quiet Quarter',    // Inactive accounts
}

// ─── Spatial Analysis Thresholds ────────────────────────────

const THRESHOLDS = {
  DOWNTOWN_STARS: 500,          // Stars needed for downtown placement
  ELITE_STARS: 5000,            // Elite tower placement
  NEON_DAYS: 7,                 // Activity within N days = "neon"
  ROOKIE_MONTHS: 12,            // Account age < N months = rookie
  VETERAN_YEARS: 5,             // Account age > N years = veteran
  DORMANT_DAYS: 180,            // No activity in N days = dormant
  MIN_DISTRICT_SIZE: 3,         // Minimum users per language district
}

/**
 * Generate complete spatial topology for a set of users.
 *
 * @param {Array} users — user objects with: username, topLanguage, totalStars, commits, repos,
 *                        followers, createdAt, recentActivity, company/org (optional)
 * @param {Object} opts — { width, height, centerWeight, includeSpecialDistricts }
 * @returns {Object} spatial topology
 */
export function generateSpatialTopology(users, opts = {}) {
  if (!users || users.length === 0) {
    return { districts: [], assignments: [], positions: [], meta: { totalUsers: 0 } }
  }

  const {
    centerWeight = 1.0,
    includeSpecialDistricts = true,
  } = opts

  // ─── Phase 1: Analyze each user's spatial dimensions ──────
  const analyzed = users.map((user, index) => analyzeSpatialDimensions(user, index))

  // ─── Phase 2: Generate districts ──────────────────────────
  const districts = []
  const assignments = new Array(users.length).fill(null)

  // 2a. Create language-based neighborhoods
  const languageGroups = groupByLanguage(analyzed)
  for (const [language, members] of languageGroups) {
    if (members.length < THRESHOLDS.MIN_DISTRICT_SIZE) continue

    // Calculate district metrics
    const avgStars = members.reduce((s, m) => s + m.stars, 0) / members.length
    const avgActivity = members.reduce((s, m) => s + m.activityScore, 0) / members.length
    const maxStars = Math.max(...members.map(m => m.stars))

    districts.push({
      id: `lang-${language.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      type: 'language',
      name: LANGUAGE_DISTRICT_NAMES[language] || `${language} Quarter`,
      language,
      color: LANGUAGE_COLORS[language] || '#888888',
      memberIndices: members.map(m => m.originalIndex),
      size: members.length,
      metrics: {
        avgStars: Math.round(avgStars),
        avgActivity: Math.round(avgActivity * 100) / 100,
        maxStars,
        totalCommits: members.reduce((s, m) => s + m.commits, 0),
      },
      priority: avgStars * 0.4 + avgActivity * 0.3 + members.length * 0.3,
    })
  }

  // 2b. Create special districts (overlay — users can be in both a language district AND a special district)
  if (includeSpecialDistricts) {
    // Downtown: High-star users
    const downtown = analyzed.filter(u => u.stars >= THRESHOLDS.DOWNTOWN_STARS)
    if (downtown.length > 0) {
      districts.push({
        id: 'special-downtown',
        type: 'special',
        name: SPECIAL_DISTRICT_NAMES.downtown,
        color: '#FFD700',
        memberIndices: downtown.map(m => m.originalIndex),
        size: downtown.length,
        metrics: {
          avgStars: Math.round(downtown.reduce((s, m) => s + m.stars, 0) / downtown.length),
          totalStars: downtown.reduce((s, m) => s + m.stars, 0),
        },
        priority: 100, // Always highest priority
        isOverlay: true,
      })
    }

    // Neon Strip: Recently active
    const neon = analyzed.filter(u => u.recentlyActive)
    if (neon.length > 0) {
      districts.push({
        id: 'special-neon',
        type: 'special',
        name: SPECIAL_DISTRICT_NAMES.neonStrip,
        color: '#00FF88',
        memberIndices: neon.map(m => m.originalIndex),
        size: neon.length,
        metrics: {
          avgActivity: Math.round(neon.reduce((s, m) => s + m.activityScore, 0) / neon.length * 100) / 100,
        },
        priority: 80,
        isOverlay: true,
        effect: 'pulse', // Frontend renders a pulsing glow
      })
    }

    // Rookie Row
    const rookies = analyzed.filter(u => u.accountAgeMonths < THRESHOLDS.ROOKIE_MONTHS)
    if (rookies.length >= THRESHOLDS.MIN_DISTRICT_SIZE) {
      districts.push({
        id: 'special-rookie',
        type: 'special',
        name: SPECIAL_DISTRICT_NAMES.rookieRow,
        color: '#88CCFF',
        memberIndices: rookies.map(m => m.originalIndex),
        size: rookies.length,
        metrics: {
          avgAge: Math.round(rookies.reduce((s, m) => s + m.accountAgeMonths, 0) / rookies.length),
        },
        priority: 20,
        isOverlay: true,
      })
    }

    // Veteran Valley
    const veterans = analyzed.filter(u => u.accountAgeMonths >= THRESHOLDS.VETERAN_YEARS * 12)
    if (veterans.length >= THRESHOLDS.MIN_DISTRICT_SIZE) {
      districts.push({
        id: 'special-veteran',
        type: 'special',
        name: SPECIAL_DISTRICT_NAMES.veteranCore,
        color: '#CC8844',
        memberIndices: veterans.map(m => m.originalIndex),
        size: veterans.length,
        metrics: {
          avgAge: Math.round(veterans.reduce((s, m) => s + m.accountAgeMonths, 0) / veterans.length),
        },
        priority: 60,
        isOverlay: true,
      })
    }

    // Quiet Quarter: Dormant
    const dormant = analyzed.filter(u => u.dormant)
    if (dormant.length >= THRESHOLDS.MIN_DISTRICT_SIZE) {
      districts.push({
        id: 'special-dormant',
        type: 'special',
        name: SPECIAL_DISTRICT_NAMES.dormant,
        color: '#444455',
        memberIndices: dormant.map(m => m.originalIndex),
        size: dormant.length,
        metrics: {},
        priority: 10,
        isOverlay: true,
        effect: 'dim', // Frontend renders dimmed buildings
      })
    }
  }

  // ─── Phase 3: Assign users to primary districts ───────────
  // Each user gets a primary district (language-based) and optional secondary overlays
  for (const district of districts) {
    if (district.isOverlay) continue
    for (const idx of district.memberIndices) {
      if (assignments[idx] === null) {
        assignments[idx] = district.id
      }
    }
  }

  // Users without a language district (language too small) → assign to "Other" or closest
  const unassigned = analyzed.filter((_, i) => assignments[i] === null)
  if (unassigned.length > 0) {
    districts.push({
      id: 'lang-other',
      type: 'language',
      name: 'Polyglot Plaza',
      language: 'Other',
      color: '#888888',
      memberIndices: unassigned.map(u => u.originalIndex),
      size: unassigned.length,
      metrics: {},
      priority: 5,
    })
    for (const u of unassigned) {
      assignments[u.originalIndex] = 'lang-other'
    }
  }

  // ─── Phase 4: Compute positions ───────────────────────────
  // Sort districts by priority (highest = city center)
  const sortedDistricts = [...districts.filter(d => !d.isOverlay)]
    .sort((a, b) => b.priority - a.priority)

  const positions = new Array(users.length)
  const districtBounds = computeDistrictPositions(sortedDistricts, analyzed, positions, centerWeight)

  // Enrich districts with spatial bounds
  for (const district of districts) {
    const bounds = districtBounds.get(district.id)
    if (bounds) {
      district.centroid = bounds.centroid
      district.boundingBox = bounds.boundingBox
      district.radius = bounds.radius
    }
  }

  // ─── Phase 5: Compute building modifiers ──────────────────
  const buildingModifiers = analyzed.map(u => ({
    heightMultiplier: computeHeightMultiplier(u),
    glowIntensity: computeGlowIntensity(u),
    pulseRate: u.recentlyActive ? 1.0 + (u.activityScore / 100) * 2.0 : 0,
    tint: u.stars >= THRESHOLDS.ELITE_STARS ? '#FFD700' : null, // Gold tint for elite
    label: u.stars >= THRESHOLDS.DOWNTOWN_STARS ? u.username : null, // Label visible buildings
  }))

  return {
    districts,
    assignments,
    positions,
    buildingModifiers,
    meta: {
      totalUsers: users.length,
      totalDistricts: districts.length,
      languageDistricts: districts.filter(d => d.type === 'language').length,
      specialDistricts: districts.filter(d => d.type === 'special').length,
      generatedAt: new Date().toISOString(),
    },
  }
}

// ─── Spatial Dimension Analysis ─────────────────────────────

function analyzeSpatialDimensions(user, index) {
  const now = Date.now()
  const createdAt = user.createdAt ? new Date(user.createdAt) : new Date('2020-01-01')
  const accountAgeMonths = Math.max(1, (now - createdAt.getTime()) / (30.44 * 24 * 60 * 60 * 1000))

  const stars = user.totalStars || user.stars || 0
  const commits = user.commits || 0
  const repos = user.repos || 0
  const followers = user.followers || 0

  // Compute activity score
  const activityScore = commits * 0.5 + repos * 0.3 + stars * 0.2

  // Determine if recently active (within NEON_DAYS)
  const recentlyActive = user.recentActivity === true ||
    (user.lastActive && (now - new Date(user.lastActive).getTime()) < THRESHOLDS.NEON_DAYS * 86400000)

  // Determine if dormant
  const dormant = !recentlyActive && accountAgeMonths > THRESHOLDS.DORMANT_DAYS / 30

  return {
    originalIndex: index,
    username: user.username,
    language: user.topLanguage || 'Other',
    stars,
    commits,
    repos,
    followers,
    activityScore,
    accountAgeMonths: Math.round(accountAgeMonths),
    recentlyActive,
    dormant,
    company: user.company || null,
  }
}

// ─── Language Grouping ──────────────────────────────────────

function groupByLanguage(analyzed) {
  const groups = new Map()
  for (const user of analyzed) {
    const lang = user.language
    if (!groups.has(lang)) groups.set(lang, [])
    groups.get(lang).push(user)
  }
  return groups
}

// ─── Position Computation ───────────────────────────────────

function computeDistrictPositions(sortedDistricts, analyzed, positions, centerWeight) {
  const spacing = 8
  const districtGap = 20
  const bounds = new Map()

  // Calculate district footprints
  const placements = sortedDistricts.map(district => {
    const members = district.memberIndices.map(i => analyzed[i])
    const cols = Math.ceil(Math.sqrt(members.length))
    const rows = Math.ceil(members.length / cols)
    const width = cols * spacing + districtGap
    const height = rows * spacing + districtGap
    return { district, members, cols, rows, width, height }
  })

  // Spiral placement
  const placed = []

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]
    let cx, cz

    if (i === 0) {
      // Highest priority district → city center
      cx = 0
      cz = 0
    } else {
      // Golden angle spiral
      const angle = i * 2.399
      let found = false

      for (let attempt = 0; attempt < 100; attempt++) {
        const radius = (40 + attempt * 25 + Math.sqrt(p.width * p.height) * 0.5) * centerWeight
        cx = Math.cos(angle + attempt * 0.2) * radius
        cz = Math.sin(angle + attempt * 0.2) * radius

        if (!overlapsAny(cx, cz, p.width, p.height, placed)) {
          found = true
          break
        }
      }

      if (!found) {
        cx = Math.cos(angle) * (200 + i * 60)
        cz = Math.sin(angle) * (200 + i * 60)
      }
    }

    placed.push({ cx, cz, width: p.width, height: p.height })

    // Sort members: high stars → center of the district
    const sortedMembers = [...p.members].sort((a, b) => b.stars - a.stars)

    const startX = cx - (p.cols - 1) * spacing / 2
    const startZ = cz - (Math.ceil(sortedMembers.length / p.cols) - 1) * spacing / 2

    for (let j = 0; j < sortedMembers.length; j++) {
      const row = Math.floor(j / p.cols)
      const col = j % p.cols

      const x = startX + col * spacing
      const z = startZ + row * spacing

      // Deterministic jitter
      const idx = sortedMembers[j].originalIndex
      const seedX = ((idx * 7 + 13) % 100) / 100
      const seedZ = ((idx * 11 + 17) % 100) / 100
      const jitterX = (seedX - 0.5) * 1.5
      const jitterZ = (seedZ - 0.5) * 1.5

      positions[idx] = [x + jitterX, 0, z + jitterZ]
    }

    bounds.set(p.district.id, {
      centroid: [cx, 0, cz],
      boundingBox: {
        minX: cx - p.width / 2,
        maxX: cx + p.width / 2,
        minZ: cz - p.height / 2,
        maxZ: cz + p.height / 2,
      },
      radius: Math.max(p.width, p.height) / 2,
    })
  }

  return bounds
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

// ─── Building Modifier Computation ──────────────────────────

function computeHeightMultiplier(user) {
  // Log-scale height based on commits
  const base = Math.log2((user.commits || 0) + 1) * 0.15
  // Star bonus
  const starBonus = Math.log2((user.stars || 0) + 1) * 0.05
  return Math.min(3.0, Math.max(0.3, base + starBonus))
}

function computeGlowIntensity(user) {
  // Stars drive glow
  const starGlow = Math.min(1.0, Math.log2((user.stars || 0) + 1) / 15)
  // Activity bonus
  const activityGlow = user.recentlyActive ? 0.3 : 0
  return Math.min(1.0, starGlow + activityGlow)
}

// ─── Cached Spatial Topology for API ────────────────────────

/**
 * Get or generate spatial topology for a list of usernames.
 * Caches topology for 5 minutes.
 *
 * @param {Array} users — user objects from DB/API
 * @returns {Object} spatial topology
 */
export async function getSpatialTopology(users) {
  // Build a stable cache key from sorted usernames
  const userKey = users.map(u => u.username).sort().join(',')
  const cacheKey = `spatial:${hashString(userKey)}`

  const cached = await cacheGet(cacheKey)
  if (cached) return cached

  const topology = generateSpatialTopology(users)
  await cacheSet(cacheKey, topology, 300) // 5 min cache

  return topology
}

/**
 * Get spatial topology for a single user's neighborhood.
 * Returns the district the user belongs to + nearby districts.
 */
export async function getUserNeighborhood(username, allUsers) {
  const topology = await getSpatialTopology(allUsers)
  const userIndex = allUsers.findIndex(u => u.username.toLowerCase() === username.toLowerCase())

  if (userIndex === -1) return null

  const primaryDistrict = topology.assignments[userIndex]
  const district = topology.districts.find(d => d.id === primaryDistrict)
  const overlays = topology.districts.filter(d =>
    d.isOverlay && d.memberIndices.includes(userIndex)
  )

  return {
    username,
    position: topology.positions[userIndex],
    modifier: topology.buildingModifiers[userIndex],
    primaryDistrict: district,
    overlayDistricts: overlays,
    neighborCount: district?.size || 0,
  }
}

// Simple string hash for cache keys
function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit int
  }
  return Math.abs(hash).toString(36)
}
