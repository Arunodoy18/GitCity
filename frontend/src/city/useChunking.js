import { useMemo } from 'react'
import { Box3, Vector3, Sphere } from 'three'

/**
 * useChunking — Divides city buildings into spatial chunks for frustum culling.
 *
 * Each chunk is a contiguous spatial region. Three.js can auto-cull entire chunks
 * whose bounding spheres fall outside the camera frustum.
 *
 * @param {Array} users - Array of user objects
 * @param {Array} positions - Array of [x, y, z] positions
 * @param {number} chunkSize - World-space size of each chunk (default: 120)
 * @returns {Array<{ id, users, positions, boundingSphere }>} chunks
 */
export function useChunking(users, positions, chunkSize = 120) {
  return useMemo(() => {
    if (!users.length || !positions.length) return []

    // Assign each building to a chunk grid cell
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

    // Compute bounding sphere for each chunk
    const chunks = []
    for (const [key, chunk] of chunkMap) {
      const box = new Box3()
      for (const [x, , z] of chunk.positions) {
        // Expand vertically to cover tallest buildings (~60 units)
        box.expandByPoint(new Vector3(x, 0, z))
        box.expandByPoint(new Vector3(x, 60, z))
      }
      const sphere = new Sphere()
      box.getBoundingSphere(sphere)

      chunks.push({
        id: key,
        users: chunk.users,
        positions: chunk.positions,
        boundingSphere: sphere,
      })
    }

    return chunks
  }, [users, positions, chunkSize])
}
