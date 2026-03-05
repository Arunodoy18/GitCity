import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Vector3, MathUtils } from 'three'

/**
 * CameraFlyTo — Smoothly animates camera to a target building position
 * Then auto-disables once arrived.
 */
export default function CameraFlyTo({ target, onArrived }) {
  const { camera } = useThree()
  const isFlying = useRef(false)
  const targetPos = useRef(new Vector3())
  const lookAt = useRef(new Vector3())
  const progress = useRef(0)
  const startPos = useRef(new Vector3())

  useEffect(() => {
    if (!target) {
      isFlying.current = false
      return
    }

    // Target = building position, camera goes above and to the side
    const [x, , z] = target
    lookAt.current.set(x, 5, z)
    targetPos.current.set(x + 15, 20, z + 15)
    startPos.current.copy(camera.position)
    progress.current = 0
    isFlying.current = true
  }, [target, camera])

  useFrame((_, delta) => {
    if (!isFlying.current) return

    progress.current += delta * 0.8 // Speed of flight
    const t = MathUtils.clamp(progress.current, 0, 1)
    // Smooth easing
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    camera.position.lerpVectors(startPos.current, targetPos.current, ease)
    
    // Smooth look-at
    const currentLook = new Vector3()
    currentLook.lerpVectors(
      startPos.current.clone().add(new Vector3(0, -5, -10)),
      lookAt.current,
      ease
    )
    camera.lookAt(currentLook)

    if (t >= 1) {
      isFlying.current = false
      onArrived?.()
    }
  })

  return null
}
