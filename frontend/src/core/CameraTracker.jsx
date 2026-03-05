import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

/**
 * CameraTracker — Reports camera position to parent via callback
 * Used for mini-map synchronization
 */
export default function CameraTracker({ onUpdate }) {
  const lastReport = useRef(0)

  useFrame(({ camera, clock }) => {
    // Throttle to ~10fps for efficiency
    const now = clock.elapsedTime
    if (now - lastReport.current > 0.1) {
      onUpdate?.([camera.position.x, camera.position.y, camera.position.z])
      lastReport.current = now
    }
  })

  return null
}
