import { useRef, useMemo, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Object3D, Color, ShaderMaterial, FrontSide, InstancedBufferAttribute, Vector3 } from 'three'
import { generateBuildingProps } from './buildingProps'

const tempObject = new Object3D()
const tempColor = new Color()

/**
 * Production-Grade Building ShaderMaterial with LOD
 *
 * Per-instance attributes:
 *   instanceColor (vec3) — base building color
 *   instanceBrightness (float) — window brightness (active=1.0, inactive=0.25)
 *   instanceTint (vec3) — subtle per-building color variation
 *   instanceCommitScore (float) — normalized commit score for heatmap mode
 *
 * Uniforms:
 *   uTime (float) — clock for flicker animation
 *   uHeatmapEnabled (float) — 0.0 or 1.0 toggle for heatmap overlay
 *   uDayNightFactor (float) — 0.0 (night) → 1.0 (day) controls lighting/windows
 *   uCameraPos (vec3) — camera world position for LOD calculations
 *   uLodNear (float) — near LOD radius (full shader)
 *   uLodMid (float) — mid LOD radius (simplified, no flicker)
 *   uLodFar (float) — far LOD radius (flat silhouette)
 *
 * LOD tiers (Wave 2A+2B):
 *   Near (< uLodNear): full shader with flicker, edge effects, heatmap
 *   Mid (uLodNear..uLodMid): windows but no flicker, no edge effects
 *   Far (> uLodMid): flat tinted silhouette, no windows
 *   Transitions smoothstepped to avoid popping (Wave 2B)
 */
const vertexShader = /* glsl */ `
  attribute vec3 instanceColor;
  attribute float instanceBrightness;
  attribute vec3 instanceTint;
  attribute float instanceCommitScore;
  attribute float instanceSeed;

  uniform vec3 uCameraPos;

  varying vec3 vColor;
  varying vec3 vTint;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying float vBrightness;
  varying float vInstanceSeed;
  varying float vCommitScore;
  varying float vCameraDist;

  void main() {
    vColor = instanceColor;
    vTint = instanceTint;
    vNormal = normalize(normalMatrix * normal);
    vLocalPosition = position;
    vBrightness = instanceBrightness;
    vCommitScore = instanceCommitScore;
    vInstanceSeed = instanceSeed;

    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;

    // Distance from camera to building center (instance origin)
    vec4 instanceOrigin = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vCameraDist = distance(uCameraPos, instanceOrigin.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uHeatmapEnabled;
  uniform float uDayNightFactor;
  uniform float uLodNear;
  uniform float uLodMid;

  varying vec3 vColor;
  varying vec3 vTint;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying float vBrightness;
  varying float vInstanceSeed;
  varying float vCommitScore;
  varying float vCameraDist;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  vec3 heatmapColor(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.25) return mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), t * 4.0);
    if (t < 0.5)  return mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 1.0, 0.0), (t - 0.25) * 4.0);
    if (t < 0.75) return mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (t - 0.5) * 4.0);
    return mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (t - 0.75) * 4.0);
  }

  void main() {
    vec3 absNormal = abs(vNormal);
    bool isSideFace = absNormal.y < 0.5;

    // LOD blending factors (smoothstepped to avoid popping — Wave 2B)
    float nearToMid = smoothstep(uLodNear * 0.85, uLodNear * 1.15, vCameraDist);
    float midToFar  = smoothstep(uLodMid * 0.85, uLodMid * 1.15, vCameraDist);

    // Per-instance tinted color
    vec3 tintedColor = vColor * (vec3(1.0) + vTint * 0.3);
    float dayBright = mix(0.3, 1.0, uDayNightFactor);
    vec3 buildingDark = tintedColor * dayBright;

    // === FAR LOD: flat silhouette ===
    if (midToFar > 0.99) {
      vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
      float diff = max(dot(vNormal, lightDir), 0.0) * 0.2 + 0.12;
      vec3 flatColor = buildingDark * diff;
      // Faint glow on active buildings
      flatColor += tintedColor * vBrightness * 0.05 * (1.0 - uDayNightFactor);
      if (uHeatmapEnabled > 0.5) {
        flatColor = mix(flatColor, heatmapColor(vCommitScore) * 0.35, 0.5);
      }
      gl_FragColor = vec4(flatColor, 1.0);
      return;
    }

    if (!isSideFace) {
      vec3 roofColor = buildingDark * 0.4;
      if (uHeatmapEnabled > 0.5) {
        roofColor = mix(roofColor, heatmapColor(vCommitScore) * 0.5, 0.6);
      }
      gl_FragColor = vec4(roofColor, 1.0);
      return;
    }

    // === Side face: procedural windows ===
    vec2 uv;
    if (absNormal.x > 0.5) {
      uv = vLocalPosition.zy + 0.5;
    } else {
      uv = vLocalPosition.xy + 0.5;
    }

    float windowsX = 6.0;
    float windowsY = 12.0;
    float windowPadding = 0.25;

    vec2 cell = floor(uv * vec2(windowsX, windowsY));
    vec2 cellUV = fract(uv * vec2(windowsX, windowsY));

    float wx = step(windowPadding, cellUV.x) * step(cellUV.x, 1.0 - windowPadding);
    float wy = step(windowPadding, cellUV.y) * step(cellUV.y, 1.0 - windowPadding);
    float windowMask = wx * wy;

    float windowSeed = hash(cell + vec2(vInstanceSeed * 0.01, vInstanceSeed * 0.007));
    float windowOn = step(0.45, windowSeed);

    // === FLICKER — only at near LOD ===
    float flicker = 1.0;
    if (nearToMid < 0.5 && vBrightness > 0.5 && windowOn > 0.5) {
      float flickerSeed = hash(cell * 3.17 + vec2(vInstanceSeed * 0.013));
      // Slow breathe
      if (flickerSeed > 0.88) {
        float breatheSpeed = 1.5 + flickerSeed * 3.0;
        float breathe = 0.8 + 0.2 * sin(uTime * breatheSpeed + flickerSeed * 6.28);
        flicker *= mix(breathe, 1.0, nearToMid * 2.0);  // fade out flicker toward mid
      }
      // Micro-spark
      float sparkSeed = hash(cell * 7.13 + vec2(vInstanceSeed * 0.019));
      if (sparkSeed > 0.95) {
        float spark = 0.9 + 0.1 * sin(uTime * (8.0 + sparkSeed * 12.0));
        flicker *= mix(spark, 1.0, nearToMid * 2.0);
      }
    }

    float nightWindowStrength = mix(1.0, 0.15, uDayNightFactor);
    vec3 windowLit = vec3(1.0, 0.9, 0.6) * (0.6 + windowSeed * 0.4);
    windowLit *= (vec3(1.0) + vTint * 0.15);
    vec3 windowColor = windowLit * vBrightness * flicker * nightWindowStrength;

    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
    float diff = max(dot(vNormal, lightDir), 0.0) * 0.3 + 0.15;
    float sunlight = max(dot(vNormal, normalize(vec3(0.3, 0.8, 0.5))), 0.0);
    diff += sunlight * uDayNightFactor * 0.5;
    vec3 wallColor = buildingDark * diff;

    vec3 detailColor = mix(wallColor, windowColor, windowMask * windowOn);

    // Edge darkening — near LOD only
    float edgeFade = smoothstep(0.0, 0.15, cellUV.x) * smoothstep(0.0, 0.15, 1.0 - cellUV.x);
    float edgeEffect = mix(0.9 + edgeFade * 0.1, 1.0, nearToMid);
    detailColor *= edgeEffect;

    // Blend between detailed and flat silhouette at mid→far transition
    vec3 flatColor = buildingDark * (diff * 0.8) + tintedColor * vBrightness * 0.03 * (1.0 - uDayNightFactor);
    vec3 finalColor = mix(detailColor, flatColor, midToFar);

    // Heatmap overlay
    if (uHeatmapEnabled > 0.5) {
      vec3 hm = heatmapColor(vCommitScore);
      finalColor = mix(finalColor, hm * (0.4 + windowMask * windowOn * 0.4), 0.55);
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`

// Shared material instance with all uniforms
const buildingMaterial = new ShaderMaterial({
  vertexShader,
  fragmentShader,
  side: FrontSide,
  uniforms: {
    uTime: { value: 0.0 },
    uHeatmapEnabled: { value: 0.0 },
    uDayNightFactor: { value: 0.0 },
    uCameraPos: { value: new Vector3(0, 80, 150) },
    uLodNear: { value: 150.0 },
    uLodMid: { value: 400.0 },
  },
})

/**
 * InstancedBuildings — Renders 10,000+ buildings with a single InstancedMesh.
 *
 * Single draw call. Per-instance attributes for color, brightness, tint, and commit score.
 * Supports heatmap overlay and day/night cycle via uniforms.
 */
export default function InstancedBuildings({
  users, positions, onBuildingClick,
  heatmapEnabled = false,
  dayNightFactor = 0.0,
  boundingSphere = null,
}) {
  const meshRef = useRef()
  const { raycaster } = useThree()

  const count = users.length

  // Precompute building properties
  const buildingData = useMemo(() => {
    return users.map((user) =>
      generateBuildingProps({
        commits: user.commits,
        repos: user.repos,
        recentActivity: user.recentActivity,
      })
    )
  }, [users])

  // Find max commits for normalizing heatmap
  const maxCommits = useMemo(() => {
    let max = 1
    for (const u of users) { if (u.commits > max) max = u.commits }
    return max
  }, [users])

  // Set up all instance data in one pass
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || count === 0) return

    const brightnessArray = new Float32Array(count)
    const tintArray = new Float32Array(count * 3)
    const commitScoreArray = new Float32Array(count)
    const seedArray = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const { height, width, depth, baseColor, emissive, emissiveIntensity } = buildingData[i]
      const [x, , z] = positions[i]

      // Matrix
      tempObject.position.set(x, height / 2, z)
      tempObject.scale.set(width, height, depth)
      tempObject.updateMatrix()
      mesh.setMatrixAt(i, tempObject.matrix)

      // Color
      if (emissiveIntensity > 0) {
        tempColor.copy(baseColor).lerp(emissive, emissiveIntensity * 0.4)
      } else {
        tempColor.copy(baseColor)
      }
      mesh.setColorAt(i, tempColor)

      // Brightness
      brightnessArray[i] = emissiveIntensity > 0 ? 1.0 : 0.25

      // Per-instance tint — subtle hue/sat shift (deterministic from index)
      const tSeed1 = ((i * 37 + 11) % 200) / 200 - 0.5  // -0.5..0.5
      const tSeed2 = ((i * 53 + 23) % 200) / 200 - 0.5
      const tSeed3 = ((i * 71 + 31) % 200) / 200 - 0.5
      tintArray[i * 3 + 0] = tSeed1 * 0.4
      tintArray[i * 3 + 1] = tSeed2 * 0.3
      tintArray[i * 3 + 2] = tSeed3 * 0.5

      // Commit score normalized 0..1
      commitScoreArray[i] = users[i].commits / maxCommits

      // Stable per-instance seed for shader randomness
      seedArray[i] = i + 1
    }

    mesh.geometry.setAttribute(
      'instanceBrightness',
      new InstancedBufferAttribute(brightnessArray, 1)
    )
    mesh.geometry.setAttribute(
      'instanceTint',
      new InstancedBufferAttribute(tintArray, 3)
    )
    mesh.geometry.setAttribute(
      'instanceCommitScore',
      new InstancedBufferAttribute(commitScoreArray, 1)
    )
    mesh.geometry.setAttribute(
      'instanceSeed',
      new InstancedBufferAttribute(seedArray, 1)
    )

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    // Set bounding sphere for frustum culling (Wave 3)
    if (boundingSphere) {
      mesh.geometry.boundingSphere = boundingSphere.clone()
    }
  }, [count, buildingData, positions, maxCommits, users, boundingSphere])

  // Per-frame uniform updates (includes camera pos for LOD)
  useFrame(({ clock, camera }) => {
    const u = buildingMaterial.uniforms
    u.uTime.value = clock.elapsedTime
    u.uHeatmapEnabled.value = heatmapEnabled ? 1.0 : 0.0
    u.uDayNightFactor.value = dayNightFactor
    u.uCameraPos.value.set(camera.position.x, camera.position.y, camera.position.z)
  })

  // Click detection
  const handleClick = (e) => {
    if (!meshRef.current) return
    e.stopPropagation()
    const intersects = raycaster.intersectObject(meshRef.current)
    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId
      if (instanceId !== undefined && users[instanceId]) {
        onBuildingClick?.(users[instanceId])
      }
    }
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, count]}
      material={buildingMaterial}
      frustumCulled={false}
      castShadow
      receiveShadow
      onClick={handleClick}
      onPointerOver={() => { document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'default' }}
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  )
}
