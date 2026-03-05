import { DoubleSide } from 'three'

/**
 * CityFloor — Ground plane, grid overlay, and road strips.
 */
export default function CityFloor() {
  return (
    <group>
      {/* Main ground plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[1600, 1600]} />
        <meshStandardMaterial
          color="#060610"
          roughness={0.95}
          metalness={0.1}
        />
      </mesh>

      {/* Grid lines — neon city feel */}
      <gridHelper
        args={[1600, 200, '#0d1a33', '#0a0f22']}
        position={[0, 0.01, 0]}
      />

      {/* Road strips along X axis */}
      {[-200, -120, -60, 0, 60, 120, 200].map((z) => (
        <mesh
          key={`road-x-${z}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, z]}
          receiveShadow
        >
          <planeGeometry args={[1600, 3]} />
          <meshStandardMaterial
            color="#0f0f22"
            roughness={0.5}
            metalness={0.4}
            side={DoubleSide}
          />
        </mesh>
      ))}

      {/* Road strips along Z axis */}
      {[-200, -120, -60, 0, 60, 120, 200].map((x) => (
        <mesh
          key={`road-z-${x}`}
          rotation={[-Math.PI / 2, 0, Math.PI / 2]}
          position={[x, 0.02, 0]}
          receiveShadow
        >
          <planeGeometry args={[1600, 3]} />
          <meshStandardMaterial
            color="#0f0f22"
            roughness={0.5}
            metalness={0.4}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
