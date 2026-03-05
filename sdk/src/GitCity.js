/**
 * GitCity — Main SDK class for rendering GitHub city visualizations
 *
 * Creates a complete 3D city scene inside a DOM container,
 * fetching data from the GitCity API.
 *
 * @example
 * const city = new GitCity({ username: 'torvalds' })
 * city.render('#container')
 */

import * as THREE from 'three'
import { VERSION } from './version.js'

const DEFAULT_API = 'http://localhost:5000'

export class GitCity {
  /**
   * @param {object} options
   * @param {string} options.username - GitHub username to visualize
   * @param {string} [options.apiUrl] - GitCity API base URL
   * @param {string[]} [options.users] - Multiple usernames for multi-city
   * @param {object} [options.theme] - Color theme overrides
   * @param {boolean} [options.controls=true] - Enable orbit controls
   * @param {boolean} [options.autoRotate=false] - Auto-rotate camera
   * @param {number} [options.width] - Canvas width (default: container width)
   * @param {number} [options.height] - Canvas height (default: container height)
   */
  constructor(options = {}) {
    this.options = {
      apiUrl: DEFAULT_API,
      controls: true,
      autoRotate: false,
      theme: {},
      ...options,
    }

    this.version = VERSION
    this.container = null
    this.scene = null
    this.camera = null
    this.renderer = null
    this.buildings = []
    this.userData = null
    this.listeners = new Map()
    this._animationId = null
    this._disposed = false
  }

  /**
   * Render the city into a DOM element.
   *
   * @param {string|HTMLElement} target - CSS selector or DOM element
   * @returns {Promise<GitCity>} this (for chaining)
   */
  async render(target) {
    // Resolve container
    this.container = typeof target === 'string'
      ? document.querySelector(target)
      : target

    if (!this.container) {
      throw new Error(`GitCity: Container "${target}" not found`)
    }

    // Setup renderer
    const width = this.options.width || this.container.clientWidth
    const height = this.options.height || this.container.clientHeight

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x060610, 1)
    this.container.appendChild(this.renderer.domElement)

    // Setup scene
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x060610, 0.003)

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000)
    this.camera.position.set(80, 50, 80)
    this.camera.lookAt(0, 0, 0)

    // Lighting
    const ambient = new THREE.AmbientLight(0x112244, 0.4)
    this.scene.add(ambient)
    const directional = new THREE.DirectionalLight(0xffffff, 0.3)
    directional.position.set(50, 100, 50)
    this.scene.add(directional)

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800),
      new THREE.MeshStandardMaterial({ color: 0x060610, roughness: 0.95 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.01
    this.scene.add(ground)

    // Grid
    const grid = new THREE.GridHelper(800, 100, 0x0d1a33, 0x0a0f22)
    grid.position.y = 0.01
    this.scene.add(grid)

    // Fetch data and build city
    await this._fetchAndBuild()

    // Start render loop
    this._animate()

    // Handle resize
    this._resizeObserver = new ResizeObserver(() => this._handleResize())
    this._resizeObserver.observe(this.container)

    // Raycaster for building clicks
    if (this.options.controls) {
      this._setupInteraction()
    }

    return this
  }

  /**
   * Fetch user data from the API and build city geometry.
   */
  async _fetchAndBuild() {
    const { apiUrl, username, users } = this.options

    try {
      let userData
      if (users && users.length > 0) {
        // Multi-user city
        const params = new URLSearchParams()
        users.forEach(u => params.append('users', u))
        const res = await fetch(`${apiUrl}/api/city/multi?${params}`)
        userData = await res.json()
        this._buildCity(userData.users || userData)
      } else if (username) {
        // Single user city
        const res = await fetch(`${apiUrl}/api/user/${username}`)
        userData = await res.json()
        this._buildCity([userData])
      }

      this.userData = userData
      this._emit('loaded', userData)
    } catch (err) {
      console.error('[GitCity SDK] Fetch error:', err)
      this._emit('error', err)
    }
  }

  /**
   * Build 3D city from user data array.
   */
  _buildCity(users) {
    if (!users || !Array.isArray(users)) return

    const theme = this.options.theme
    const cols = Math.ceil(Math.sqrt(users.length))
    const spacing = 8

    users.forEach((user, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols

      const x = (col - cols / 2) * spacing
      const z = (row - cols / 2) * spacing

      // Building dimensions from metrics
      const commits = user.commits || user.metrics?.commits || 50
      const repos = user.repos || user.metrics?.repos || 5
      const height = Math.max(1, Math.min(60, commits / 50))
      const width = Math.max(1, Math.min(8, repos * 0.5))
      const depth = width * 0.8

      // Color
      const hue = (commits % 360) / 360
      const color = new THREE.Color().setHSL(hue, 0.6, 0.15)
      if (theme.buildingColor) color.set(theme.buildingColor)

      const geometry = new THREE.BoxGeometry(width, height, depth)
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness: 0.3,
        emissive: user.recentActivity ? new THREE.Color().setHSL(hue, 0.9, 0.3) : new THREE.Color(0x000000),
        emissiveIntensity: user.recentActivity ? 0.5 : 0,
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x, height / 2, z)
      mesh.userData = { user, index: i }

      this.scene.add(mesh)
      this.buildings.push(mesh)
    })
  }

  /**
   * Animation loop.
   */
  _animate() {
    if (this._disposed) return
    this._animationId = requestAnimationFrame(() => this._animate())

    if (this.options.autoRotate) {
      const t = Date.now() * 0.0002
      const r = 100
      this.camera.position.x = Math.cos(t) * r
      this.camera.position.z = Math.sin(t) * r
      this.camera.lookAt(0, 0, 0)
    }

    this.renderer.render(this.scene, this.camera)
  }

  /**
   * Setup click interaction.
   */
  _setupInteraction() {
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    this.renderer.domElement.addEventListener('click', (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, this.camera)
      const intersects = raycaster.intersectObjects(this.buildings)

      if (intersects.length > 0) {
        const building = intersects[0].object
        this._emit('buildingClick', building.userData.user)
      }
    })
  }

  /**
   * Handle container resize.
   */
  _handleResize() {
    if (!this.container || !this.renderer || this._disposed) return
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  // ─── Event System ─────────────────────────────────────────

  /**
   * Listen for events.
   * @param {string} event - 'loaded' | 'error' | 'buildingClick'
   * @param {function} callback
   * @returns {GitCity}
   */
  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, [])
    this.listeners.get(event).push(callback)
    return this
  }

  /**
   * Remove event listener.
   */
  off(event, callback) {
    const cbs = this.listeners.get(event)
    if (cbs) {
      const idx = cbs.indexOf(callback)
      if (idx >= 0) cbs.splice(idx, 1)
    }
    return this
  }

  /** @internal */
  _emit(event, data) {
    const cbs = this.listeners.get(event)
    if (cbs) cbs.forEach(cb => cb(data))
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Update the city with new data.
   * @param {object} options - New options (username, users, etc.)
   */
  async update(options = {}) {
    Object.assign(this.options, options)
    // Remove old buildings
    for (const b of this.buildings) {
      this.scene.remove(b)
      b.geometry.dispose()
      b.material.dispose()
    }
    this.buildings = []
    await this._fetchAndBuild()
  }

  /**
   * Dispose the city and free resources.
   */
  dispose() {
    this._disposed = true
    if (this._animationId) cancelAnimationFrame(this._animationId)
    if (this._resizeObserver) this._resizeObserver.disconnect()

    for (const b of this.buildings) {
      b.geometry.dispose()
      b.material.dispose()
    }
    this.buildings = []

    if (this.renderer) {
      this.renderer.dispose()
      this.renderer.domElement.remove()
    }

    this.scene = null
    this.camera = null
    this.renderer = null
    this.listeners.clear()
  }
}
