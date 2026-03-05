import { Canvas } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { Suspense } from 'react'
import { FogExp2 } from 'three'
import SkyGradient from './SkyGradient'

/**
 * SceneManager — Owns the Canvas, scene environment, fog, sky, and starfield.
 * All 3D children (RendererManager, CityManager, ControlManager) render inside.
 */
export default function SceneManager({ children, dayNightFactor = 0.0 }) {
  return (
    <Canvas
      shadows
      camera={{ position: [150, 80, 150], fov: 50, near: 0.1, far: 3000 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      style={{ background: '#0a0a1a' }}
      dpr={[1, 1.5]}
      onCreated={({ scene }) => {
        // Exponential fog for atmospheric depth
        scene.fog = new FogExp2('#060612', 0.0025)
      }}
    >
      <color attach="background" args={['#030308']} />

      <Suspense fallback={null}>
        {/* Dark blue gradient sky dome */}
        <SkyGradient dayNightFactor={dayNightFactor} />

        {/* Starfield */}
        <Stars
          radius={300}
          depth={80}
          count={5000}
          factor={5}
          saturation={0.6}
          fade
          speed={0.3}
        />

        {children}
      </Suspense>
    </Canvas>
  )
}
