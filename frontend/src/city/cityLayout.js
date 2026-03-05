/**
 * cityLayout.js — Shared city grid position computation
 *
 * Used by CityManager (3D rendering) and App (mini-map, fly-target resolution).
 * Deterministic: same users array always produces same positions.
 */

export function computePositions(users) {
  if (!users || users.length === 0) return []

  const cols = Math.ceil(Math.sqrt(users.length))
  const spacing = 8
  const blockSize = 10
  const streetWidth = 6

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
    const jitterX = (seedX - 0.5) * 1.5
    const jitterZ = (seedZ - 0.5) * 1.5

    return [x + jitterX, 0, z + jitterZ]
  })
}
