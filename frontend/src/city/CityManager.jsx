import { useMemo } from 'react'
import InstancedBuildings from './InstancedBuildings'
import CityFloor from './CityFloor'
import { useChunking } from './useChunking'

/**
 * CityManager — Orchestrates the city's 3D geometry.
 *
 * Responsibilities:
 * - Render the ground/floor
 * - Apply radial falloff skyline to building heights
 * - Divide city into spatial chunks for frustum culling (Wave 3)
 * - Render instanced buildings per chunk at computed positions
 * - Forward building click events
 */
export default function CityManager({ users, positions, onBuildingClick, heatmapEnabled, dayNightFactor }) {
  // Apply radial falloff: center buildings get full height, edges shrink
  const usersWithFalloff = useMemo(() => {
    if (!positions || positions.length === 0) return users

    // Find city bounds to compute normalized distance
    let maxDist = 0
    const distances = positions.map(([x, , z]) => {
      const d = Math.sqrt(x * x + z * z)
      if (d > maxDist) maxDist = d
      return d
    })

    if (maxDist === 0) return users

    return users.map((user, i) => {
      const normalizedDist = distances[i] / maxDist // 0 = center, 1 = edge

      // Radial falloff curve: center=1.0, edge=0.15
      // Using smoothstep-like curve for natural falloff
      const t = normalizedDist
      const falloff = 1.0 - t * t * (3.0 - 2.0 * t) * 0.85

      // Deterministic per-building randomness (±20%)
      const seed = ((i * 31 + 17) % 100) / 100
      const randomFactor = 0.8 + seed * 0.4

      // Scale commits to affect building height via falloff
      const scaledCommits = Math.round(user.commits * falloff * randomFactor)

      return {
        ...user,
        commits: Math.max(10, scaledCommits),
      }
    })
  }, [users, positions])

  // Divide into spatial chunks for frustum culling (Wave 3)
  const chunks = useChunking(usersWithFalloff, positions, 120)

  return (
    <group>
      <CityFloor />
      {chunks.map((chunk) => (
        <InstancedBuildings
          key={chunk.id}
          users={chunk.users}
          positions={chunk.positions}
          boundingSphere={chunk.boundingSphere}
          onBuildingClick={onBuildingClick}
          heatmapEnabled={heatmapEnabled}
          dayNightFactor={dayNightFactor}
        />
      ))}
    </group>
  )
}
