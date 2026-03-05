/**
 * shaders.js — Production-grade GLSL shaders for GitCity buildings
 *
 * Features:
 * - Per-building color grading with instanceColor + instanceTint
 * - Animated window flicker (near LOD only)
 * - Heatmap overlay mode
 * - Day/Night transition
 * - 3-tier distance-based LOD with smooth transitions
 *
 * LOD Tiers:
 *   Near (< uLodNear): Full shader — flicker, edge effects, heatmap
 *   Mid  (uLodNear..uLodMid): Simplified — windows, no flicker
 *   Far  (> uLodMid): Flat tinted silhouette, no windows
 */

export const vertexShader = /* glsl */ `
  attribute vec3 instanceColor;
  attribute float instanceBrightness;
  attribute vec3 instanceTint;
  attribute float instanceCommitScore;

  uniform vec3 uCameraPos;

  varying vec3 vColor;
  varying vec3 vTint;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying float vBrightness;
  varying float vInstanceId;
  varying float vCommitScore;
  varying float vCameraDist;

  void main() {
    vColor = instanceColor;
    vTint = instanceTint;
    vNormal = normalize(normalMatrix * normal);
    vLocalPosition = position;
    vBrightness = instanceBrightness;
    vCommitScore = instanceCommitScore;
    vInstanceId = float(gl_InstanceID);

    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vCameraDist = distance(worldPos.xyz, uCameraPos);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

export const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uHeatmapEnabled;
  uniform float uDayNightFactor;
  uniform float uLodNear;
  uniform float uLodMid;
  uniform float uLodFar;

  varying vec3 vColor;
  varying vec3 vTint;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying float vBrightness;
  varying float vInstanceId;
  varying float vCommitScore;
  varying float vCameraDist;

  // Pseudo-random hash
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  // Smoothstep LOD blend
  float lodBlend(float dist, float near, float far) {
    return smoothstep(near, far, dist);
  }

  // Heatmap color ramp: blue → green → yellow → red
  vec3 heatmapColor(float t) {
    if (t < 0.33) return mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0), t / 0.33);
    if (t < 0.66) return mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (t - 0.33) / 0.33);
    return mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (t - 0.66) / 0.34);
  }

  void main() {
    // === LOD tier calculation ===
    float nearToMid = lodBlend(vCameraDist, uLodNear, uLodMid);
    float midToFar = lodBlend(vCameraDist, uLodMid, uLodFar);

    // === Base color with tint variation ===
    vec3 base = vColor + vTint * 0.15;

    // === Day/Night lighting ===
    float dayAmbient = mix(0.08, 0.35, uDayNightFactor);
    float dayDiffuse = mix(0.15, 0.6, uDayNightFactor);
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
    float diff = max(dot(vNormal, lightDir), 0.0);
    vec3 lit = base * (dayAmbient + diff * dayDiffuse);

    // === Far LOD: flat silhouette ===
    if (midToFar > 0.99) {
      vec3 farColor = lit * 0.6 + vec3(0.02, 0.02, 0.05);
      gl_FragColor = vec4(farColor, 1.0);
      return;
    }

    // === Window grid (mid + near) ===
    float windowsAlpha = 1.0 - nearToMid * 0.5;
    vec2 uv = vLocalPosition.xy;
    float windowX = step(0.35, fract(uv.x * 4.0));
    float windowY = step(0.35, fract(uv.y * 8.0));
    float windowMask = windowX * windowY;

    // Per-window on/off (deterministic)
    float wHash = hash(vec2(floor(uv.x * 4.0), floor(uv.y * 8.0)) + vInstanceId);
    float windowOn = step(0.35, wHash) * vBrightness;

    // === Near LOD: flicker animation ===
    float flicker = 1.0;
    if (nearToMid < 0.5) {
      float flickerHash = hash(vec2(vInstanceId, floor(uTime * 2.0)));
      flicker = 0.85 + 0.15 * flickerHash;
    }

    // Window emission
    float nightWindowBright = mix(0.6, 0.05, uDayNightFactor);
    vec3 windowColor = vec3(1.0, 0.95, 0.8) * windowOn * windowMask * nightWindowBright * flicker * windowsAlpha;

    // === Heatmap overlay ===
    vec3 heatOverlay = vec3(0.0);
    if (uHeatmapEnabled > 0.5) {
      heatOverlay = heatmapColor(vCommitScore) * 0.3;
    }

    // === Edge highlight (near LOD only) ===
    float edgeAlpha = 0.0;
    if (nearToMid < 0.3) {
      float edge = 1.0 - abs(dot(vNormal, normalize(vec3(0.0, 0.0, 1.0))));
      edgeAlpha = pow(edge, 3.0) * 0.15 * (1.0 - nearToMid / 0.3);
    }

    vec3 finalColor = lit + windowColor + heatOverlay + vec3(edgeAlpha);

    // Blend toward far color
    vec3 farBlend = lit * 0.6 + vec3(0.02, 0.02, 0.05);
    finalColor = mix(finalColor, farBlend, midToFar);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`

/**
 * Create a Three.js ShaderMaterial config object for buildings.
 *
 * @param {object} [options]
 * @param {number} [options.lodNear=100]
 * @param {number} [options.lodMid=300]
 * @param {number} [options.lodFar=600]
 * @returns {object} Uniforms + shader source config
 */
export function createBuildingMaterial(options = {}) {
  const { lodNear = 100, lodMid = 300, lodFar = 600 } = options

  return {
    uniforms: {
      uTime: { value: 0 },
      uHeatmapEnabled: { value: 0 },
      uDayNightFactor: { value: 0 },
      uCameraPos: { value: [0, 0, 0] },
      uLodNear: { value: lodNear },
      uLodMid: { value: lodMid },
      uLodFar: { value: lodFar },
    },
    vertexShader,
    fragmentShader,
  }
}
