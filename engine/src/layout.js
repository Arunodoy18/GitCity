/**
 * layout.js — City grid position computation algorithms
 *
 * Deterministic: same input always produces same positions.
 * Supports both grid and radial layouts.
 */

/**
 * Compute grid positions with streets and jitter.
 *
 * @param {Array} users - Array of user/building objects
 * @param {object} [options]
 * @param {number} [options.spacing=8] - Base spacing between buildings
 * @param {number} [options.blockSize=10] - Buildings per block before a street
 * @param {number} [options.streetWidth=6] - Width of streets between blocks
 * @param {number} [options.jitter=1.5] - Max jitter offset for organic feel
 * @returns {Array<[number, number, number]>} Array of [x, y, z] positions
 */
export function computePositions(users, options = {}) {
  if (!users || users.length === 0) return []

  const {
    spacing = 8,
    blockSize = 10,
    streetWidth = 6,
    jitter = 1.5,
  } = options

  const cols = Math.ceil(Math.sqrt(users.length))

  return users.map((user, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols

    const streetGapX = Math.floor(col / blockSize) * streetWidth
    const streetGapZ = Math.floor(row / blockSize) * streetWidth

    const x = (col - cols / 2) * spacing + streetGapX
    const z = (row - cols / 2) * spacing + streetGapZ

    // Deterministic jitter (seeded from index, no Math.random)
    const seedX = ((index * 7 + 13) % 100) / 100
    const seedZ = ((index * 11 + 17) % 100) / 100
    const jitterX = (seedX - 0.5) * jitter
    const jitterZ = (seedZ - 0.5) * jitter

    return [x + jitterX, 0, z + jitterZ]
  })
}

/**
 * Compute radial positions — spiraling outward from center.
 *
 * @param {Array} users - Array of user/building objects
 * @param {object} [options]
 * @param {number} [options.baseRadius=20] - Starting radius
 * @param {number} [options.growthRate=0.15] - How quickly the spiral expands
 * @param {number} [options.spacing=8] - Min distance between buildings
 * @returns {Array<[number, number, number]>} Array of [x, y, z] positions
 */
export function computePositionsRadial(users, options = {}) {
  if (!users || users.length === 0) return []

  const {
    baseRadius = 20,
    growthRate = 0.15,
    spacing = 8,
  } = options

  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  return users.map((_, index) => {
    const angle = index * goldenAngle
    const radius = baseRadius + Math.sqrt(index) * spacing * growthRate
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    return [x, 0, z]
  })
}
