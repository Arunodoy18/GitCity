import { OrbitControls } from '@react-three/drei'
import FlyControls from './FlyControls'
import CameraFlyTo from './CameraFlyTo'
import CameraTracker from './CameraTracker'

/**
 * ControlManager — Orchestrates all camera control systems.
 *
 * Modes:
 *   Orbit  — drei OrbitControls with damped inertia
 *   Fly    — Velocity-based WASD + mouse-look (PointerLock)
 *
 * Also manages:
 *   - Smooth camera fly-to on search
 *   - Camera position reporting for mini-map
 */
export default function ControlManager({
  flyMode,
  onFlyExit,
  flyTargetPos,
  onFlyArrived,
  onCameraUpdate,
}) {
  return (
    <>
      {/* Camera fly-to animation (works regardless of mode) */}
      {flyTargetPos && (
        <CameraFlyTo target={flyTargetPos} onArrived={onFlyArrived} />
      )}

      {/* Camera position reporter for mini-map */}
      <CameraTracker onUpdate={onCameraUpdate} />

      {/* Controls — toggle between orbit and fly */}
      {flyMode ? (
        <FlyControls enabled onExit={onFlyExit} />
      ) : (
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.06}
          minDistance={5}
          maxDistance={600}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 0, 0]}
        />
      )}
    </>
  )
}
