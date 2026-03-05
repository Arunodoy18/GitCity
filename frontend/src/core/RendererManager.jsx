import { EffectComposer, Bloom } from '@react-three/postprocessing'

/**
 * RendererManager — All scene lighting and post-processing.
 *
 * Adapts lighting to day/night factor:
 *   Night (0): neon city, moonlight, dim ambient
 *   Day (1): sun-based, brighter ambient, reduced point lights
 */
export default function RendererManager({ dayNightFactor = 0.0 }) {
  const dnf = dayNightFactor

  // Interpolated values
  const ambientIntensity = 0.12 + dnf * 0.4
  const moonIntensity = 0.5 * (1.0 - dnf * 0.6)
  const sunIntensity = dnf * 0.8
  const hemisphereIntensity = 0.3 + dnf * 0.3
  const neonScale = 1.0 - dnf * 0.7  // point lights dim during day
  const bloomIntensity = 0.8 * (1.0 - dnf * 0.6)

  return (
    <>
      {/* === Lighting === */}

      <ambientLight
        intensity={ambientIntensity}
        color={dnf > 0.5 ? '#88aacc' : '#334477'}
      />

      {/* Moonlight */}
      <directionalLight
        position={[50, 100, 30]}
        intensity={moonIntensity}
        color="#6677aa"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-400}
        shadow-camera-right={400}
        shadow-camera-top={400}
        shadow-camera-bottom={-400}
        shadow-camera-near={0.5}
        shadow-camera-far={600}
      />

      {/* Sunlight (ramps up during day) */}
      {dnf > 0.05 && (
        <directionalLight
          position={[100, 200, 80]}
          intensity={sunIntensity}
          color="#ffe8cc"
          castShadow
        />
      )}

      {/* Warm accent */}
      <directionalLight
        position={[-60, 40, -60]}
        intensity={0.15}
        color="#ff6633"
      />

      <hemisphereLight
        args={[
          dnf > 0.5 ? '#8899bb' : '#1a1a3a',
          '#050508',
          hemisphereIntensity,
        ]}
      />

      {/* Neon point lights — dimmed during day */}
      <pointLight position={[0, 20, 0]} intensity={3 * neonScale} color="#00aaff" distance={120} decay={2} />
      <pointLight position={[80, 12, -60]} intensity={2 * neonScale} color="#ff00aa" distance={80} decay={2} />
      <pointLight position={[-70, 15, 80]} intensity={2 * neonScale} color="#00ffaa" distance={80} decay={2} />
      <pointLight position={[120, 10, 100]} intensity={1.5 * neonScale} color="#ffaa00" distance={70} decay={2} />
      <pointLight position={[-100, 18, -80]} intensity={2 * neonScale} color="#aa00ff" distance={80} decay={2} />
      <pointLight position={[50, 8, 140]} intensity={1.5 * neonScale} color="#00ffff" distance={70} decay={2} />
      <pointLight position={[-140, 12, 0]} intensity={1.5 * neonScale} color="#ff4488" distance={70} decay={2} />
      <pointLight position={[0, 15, -120]} intensity={2 * neonScale} color="#4488ff" distance={80} decay={2} />
      <pointLight position={[-50, 10, -150]} intensity={1.5 * neonScale} color="#ff8844" distance={60} decay={2} />

      {/* === Post-Processing === */}
      <EffectComposer>
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={0.3}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  )
}
