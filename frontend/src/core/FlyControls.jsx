import { useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'

/**
 * FlyControls — Velocity-based WASD + mouse-look camera
 *
 * Physics model:
 *   acceleration → velocity → position (all frame-independent via delta)
 *   Exponential drag decays velocity each frame for smooth inertia.
 *
 * Bindings:
 *   WASD / Arrows  — horizontal move
 *   Space           — ascend
 *   C / Ctrl        — descend
 *   Shift           — sprint (2.5× speed)
 *   Mouse           — look (PointerLock)
 *   Escape          — exit fly mode
 */

const BASE_SPEED   = 60   // units/s base acceleration
const SPRINT_MULT  = 2.5  // shift multiplier
const DRAG         = 5    // friction coefficient (higher = snappier stop)
const VERT_SPEED   = 40   // vertical units/s
const SENSITIVITY  = 0.002
const MIN_Y        = 2    // floor clamp
const MAX_PITCH    = Math.PI / 2.2

export default function FlyControls({ enabled, onExit }) {
  const { camera, gl } = useThree()

  const keys = useRef({
    forward: false, backward: false,
    left: false, right: false,
    up: false, down: false,
    sprint: false,
  })
  const euler    = useRef({ x: 0, y: 0 })
  const locked   = useRef(false)
  const velocity = useRef(new Vector3())
  const vertVel  = useRef(0)

  /* ---- Mouse look ---- */
  const onMouseMove = useCallback((e) => {
    if (!locked.current) return
    euler.current.y -= e.movementX * SENSITIVITY
    euler.current.x -= e.movementY * SENSITIVITY
    euler.current.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, euler.current.x))
  }, [])

  /* ---- Keyboard ---- */
  const onKeyDown = useCallback((e) => {
    if (!locked.current) return
    const c = e.code
    if (c === 'KeyW' || c === 'ArrowUp')    keys.current.forward  = true
    if (c === 'KeyS' || c === 'ArrowDown')   keys.current.backward = true
    if (c === 'KeyA' || c === 'ArrowLeft')   keys.current.left     = true
    if (c === 'KeyD' || c === 'ArrowRight')  keys.current.right    = true
    if (c === 'Space')    { e.preventDefault(); keys.current.up = true }
    if (c === 'KeyC' || c === 'ControlLeft' || c === 'ControlRight') keys.current.down = true
    if (c === 'ShiftLeft' || c === 'ShiftRight') keys.current.sprint = true
    if (c === 'Escape' && document.pointerLockElement) document.exitPointerLock()
  }, [])

  const onKeyUp = useCallback((e) => {
    const c = e.code
    if (c === 'KeyW' || c === 'ArrowUp')    keys.current.forward  = false
    if (c === 'KeyS' || c === 'ArrowDown')   keys.current.backward = false
    if (c === 'KeyA' || c === 'ArrowLeft')   keys.current.left     = false
    if (c === 'KeyD' || c === 'ArrowRight')  keys.current.right    = false
    if (c === 'Space')    keys.current.up    = false
    if (c === 'KeyC' || c === 'ControlLeft' || c === 'ControlRight') keys.current.down = false
    if (c === 'ShiftLeft' || c === 'ShiftRight') keys.current.sprint = false
  }, [])

  /* ---- Pointer lock ---- */
  const onLockChange = useCallback(() => {
    locked.current = !!document.pointerLockElement
    if (!document.pointerLockElement && enabled) onExit?.()
  }, [enabled, onExit])

  /* ---- Lifecycle ---- */
  useEffect(() => {
    if (!enabled) {
      if (document.pointerLockElement) document.exitPointerLock()
      locked.current = false
      velocity.current.set(0, 0, 0)
      vertVel.current = 0
      return
    }

    gl.domElement.requestPointerLock()

    // Seed euler from current camera facing direction
    euler.current.y = Math.atan2(-camera.position.x, -camera.position.z)
    euler.current.x = 0

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('pointerlockchange', onLockChange)

    const saved = keys.current
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('pointerlockchange', onLockChange)
      saved.forward = saved.backward = saved.left = saved.right =
        saved.up = saved.down = saved.sprint = false
    }
  }, [enabled, gl, camera, onMouseMove, onKeyDown, onKeyUp, onLockChange])

  /* ---- Per-frame physics ---- */
  useFrame(({ camera: cam }, delta) => {
    if (!enabled || !locked.current) return

    // Clamp delta to avoid huge jumps after tab-switch
    const dt = Math.min(delta, 0.1)

    const k = keys.current
    const accel = k.sprint ? BASE_SPEED * SPRINT_MULT : BASE_SPEED

    // --- Look ---
    cam.rotation.order = 'YXZ'
    cam.rotation.y = euler.current.y
    cam.rotation.x = euler.current.x

    // --- Horizontal acceleration ---
    const wish = new Vector3()
    if (k.forward)  wish.z -= 1
    if (k.backward) wish.z += 1
    if (k.left)     wish.x -= 1
    if (k.right)    wish.x += 1

    if (wish.lengthSq() > 0) {
      wish.normalize().applyQuaternion(cam.quaternion).multiplyScalar(accel)
      // Project wish onto horizontal plane (don't fly into ground looking down)
      wish.y = 0
    }

    // Apply acceleration then drag (semi-implicit Euler)
    velocity.current.addScaledVector(wish, dt)
    const dragFactor = Math.exp(-DRAG * dt)  // exponential decay
    velocity.current.multiplyScalar(dragFactor)

    // Kill tiny residual velocity to avoid drift
    if (velocity.current.lengthSq() < 0.001) velocity.current.set(0, 0, 0)

    cam.position.addScaledVector(velocity.current, dt)

    // --- Vertical (world-space, separate axis) ---
    let vertAccel = 0
    if (k.up)   vertAccel += VERT_SPEED
    if (k.down) vertAccel -= VERT_SPEED

    vertVel.current += vertAccel * dt
    vertVel.current *= dragFactor
    if (Math.abs(vertVel.current) < 0.01) vertVel.current = 0

    cam.position.y += vertVel.current * dt

    // Floor clamp
    if (cam.position.y < MIN_Y) {
      cam.position.y = MIN_Y
      vertVel.current = 0
    }
  })

  return null
}
