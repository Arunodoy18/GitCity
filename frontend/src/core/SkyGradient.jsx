import { BackSide, ShaderMaterial } from 'three'
import { useFrame } from '@react-three/fiber'

/**
 * SkyGradient — Day/Night gradient sky dome.
 *
 * Blends between night sky (dark blue) and day sky (bright blue)
 * using the dayNightFactor uniform.
 */
const skyVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const skyFragmentShader = /* glsl */ `
  uniform float uDayNightFactor;

  varying vec3 vWorldPosition;

  void main() {
    float h = normalize(vWorldPosition).y;

    // Night palette
    vec3 nBottom  = vec3(0.012, 0.012, 0.031);
    vec3 nHorizon = vec3(0.051, 0.082, 0.125);
    vec3 nTop     = vec3(0.039, 0.039, 0.18);

    // Day palette
    vec3 dBottom  = vec3(0.55, 0.65, 0.75);
    vec3 dHorizon = vec3(0.65, 0.80, 0.95);
    vec3 dTop     = vec3(0.25, 0.45, 0.85);

    // Compute night and day colors
    vec3 nightColor, dayColor;
    if (h < 0.0) {
      nightColor = nBottom;
      dayColor = dBottom;
    } else if (h < 0.3) {
      float t = h / 0.3;
      nightColor = mix(nHorizon, nTop, t * 0.3);
      dayColor = mix(dHorizon, dTop, t * 0.3);
    } else {
      nightColor = mix(nHorizon, nTop, smoothstep(0.0, 0.6, h));
      dayColor = mix(dHorizon, dTop, smoothstep(0.0, 0.6, h));
    }

    vec3 color = mix(nightColor, dayColor, uDayNightFactor);
    gl_FragColor = vec4(color, 1.0);
  }
`

const skyMaterial = new ShaderMaterial({
  vertexShader: skyVertexShader,
  fragmentShader: skyFragmentShader,
  side: BackSide,
  depthWrite: false,
  uniforms: {
    uDayNightFactor: { value: 0.0 },
  },
})

export default function SkyGradient({ dayNightFactor = 0.0 }) {
  useFrame(() => {
    skyMaterial.uniforms.uDayNightFactor.value = dayNightFactor
  })

  return (
    <mesh material={skyMaterial}>
      <sphereGeometry args={[2000, 32, 16]} />
    </mesh>
  )
}
