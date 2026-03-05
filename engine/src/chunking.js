/**
 * chunking.js — Spatial partitioning for frustum culling
 *
 * Divides city into grid chunks. Each chunk has a bounding sphere
 * that Three.js can use for efficient frustum culling of entire groups.
 */

/**
 * Divide buildings into spatial chunks.
 *
 * @param {Array} users - Array of user/building objects
 * @param {Array<[number, number, number]>} positions - Corresponding positions
 * @param {number} [chunkSize=120] - World-space size of each chunk
 * @returns {Array<{ id: string, users: Array, positions: Array, boundingSphere: object }>}
 */
export function createChunks(users, positions, chunkSize = 120) {
  if (!users.length || !positions.length) return []

  const chunkMap = new Map()

  for (let i = 0; i < users.length; i++) {
    const [x, , z] = positions[i]
    const cx = Math.floor(x / chunkSize)
    const cz = Math.floor(z / chunkSize)
    const key = `${cx},${cz}`

    if (!chunkMap.has(key)) {
      chunkMap.set(key, { users: [], positions: [], indices: [] })
    }
    const chunk = chunkMap.get(key)
    chunk.users.push(users[i])
    chunk.positions.push(positions[i])
    chunk.indices.push(i)
  }

  const chunks = []
  for (const [key, chunk] of chunkMap) {
    const sphere = computeBoundingSphere(chunk.positions)
    chunks.push({
      id: key,
      users: chunk.users,
      positions: chunk.positions,
      boundingSphere: sphere,
    })
  }

  return chunks
}

/**
 * Compute a bounding sphere from an array of positions.
 *
 * @param {Array<[number, number, number]>} positions
 * @param {number} [maxHeight=60] - Max building height for vertical bounds
 * @returns {{ center: [number, number, number], radius: number }}
 */
export function computeBoundingSphere(positions, maxHeight = 60) {
  if (!positions.length) {
    return { center: [0, 0, 0], radius: 0 }
  }

  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const [x, , z] of positions) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }

  const centerX = (minX + maxX) / 2
  const centerY = maxHeight / 2
  const centerZ = (minZ + maxZ) / 2

  // Radius must cover the full extent
  let maxDistSq = 0
  for (const [x, , z] of positions) {
    const dx = x - centerX
    const dz = z - centerZ
    const distSq = dx * dx + centerY * centerY + dz * dz
    if (distSq > maxDistSq) maxDistSq = distSq
  }

  return {
    center: [centerX, centerY, centerZ],
    radius: Math.sqrt(maxDistSq) * 1.1, // 10% margin
  }
}
