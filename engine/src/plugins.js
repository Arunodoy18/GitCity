/**
 * plugins.js — GitCity Plugin System
 *
 * Extensible hook-based architecture that lets community plugins modify
 * cities, buildings, overlays, and metric providers without touching core code.
 *
 * Hook types:
 *   modifyBuilding(building, metrics)  — alter individual building props
 *   modifyCity(city, buildings)        — alter the entire city layout
 *   addOverlayLayer(scene, data)       — inject custom overlay layers
 *   addMetricProvider(username)         — supply additional metric data
 *
 * Usage:
 *   const pm = createPluginManager()
 *   pm.registerPlugin({ name: 'my-plugin', modifyBuilding(b, m) { ... } })
 *   const building = pm.applyBuildingHooks(originalBuilding, metrics)
 */

/**
 * @typedef {object} GitCityPlugin
 * @property {string} name - Unique plugin identifier
 * @property {string} [version] - Semver version string
 * @property {string} [description] - Human-readable description
 * @property {function} [init] - Called once when plugin is registered
 * @property {function} [destroy] - Called when plugin is unregistered
 * @property {function} [modifyBuilding] - (building, metrics) => building
 * @property {function} [modifyCity] - (city, buildings) => city
 * @property {function} [addOverlayLayer] - (scene, data) => overlayConfig
 * @property {function} [addMetricProvider] - (username) => Promise<metrics>
 */

export class PluginManager {
  constructor() {
    /** @type {Map<string, GitCityPlugin>} */
    this.plugins = new Map()

    /** @type {Map<string, Array<function>>} */
    this.hooks = new Map([
      ['modifyBuilding', []],
      ['modifyCity', []],
      ['addOverlayLayer', []],
      ['addMetricProvider', []],
    ])
  }

  /**
   * Register a plugin.
   *
   * @param {GitCityPlugin} plugin
   * @returns {void}
   * @throws {Error} If plugin name is missing or duplicate
   *
   * @example
   * manager.registerPlugin({
   *   name: 'language-color',
   *   modifyBuilding(building, metrics) {
   *     if (metrics.language === 'Python') building.color = '#3572A5'
   *     return building
   *   }
   * })
   */
  registerPlugin(plugin) {
    if (!plugin || !plugin.name) {
      throw new Error('Plugin must have a name')
    }
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`)
    }

    this.plugins.set(plugin.name, plugin)

    // Register hooks
    for (const [hookName, hookArray] of this.hooks) {
      if (typeof plugin[hookName] === 'function') {
        hookArray.push(plugin[hookName].bind(plugin))
      }
    }

    // Call init if defined
    if (typeof plugin.init === 'function') {
      plugin.init(this)
    }

    console.log(`[GitCity] Plugin registered: ${plugin.name}${plugin.version ? ` v${plugin.version}` : ''}`)
  }

  /**
   * Unregister a plugin by name.
   *
   * @param {string} name
   */
  unregisterPlugin(name) {
    const plugin = this.plugins.get(name)
    if (!plugin) return

    // Remove hooks
    for (const [hookName, hookArray] of this.hooks) {
      if (typeof plugin[hookName] === 'function') {
        const idx = hookArray.indexOf(plugin[hookName])
        if (idx >= 0) hookArray.splice(idx, 1)
      }
    }

    // Call destroy if defined
    if (typeof plugin.destroy === 'function') {
      plugin.destroy()
    }

    this.plugins.delete(name)
    console.log(`[GitCity] Plugin unregistered: ${name}`)
  }

  /**
   * Get a registered plugin by name.
   *
   * @param {string} name
   * @returns {GitCityPlugin|undefined}
   */
  getPlugin(name) {
    return this.plugins.get(name)
  }

  /**
   * List all registered plugins.
   *
   * @returns {Array<{ name: string, version?: string, description?: string }>}
   */
  listPlugins() {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.name,
      version: p.version || '0.0.0',
      description: p.description || '',
    }))
  }

  // ─── Hook Runners ──────────────────────────────────────────────

  /**
   * Apply all modifyBuilding hooks in registration order.
   *
   * @param {object} building - Building properties (height, width, color, etc.)
   * @param {object} metrics - User metrics (commits, repos, language, etc.)
   * @returns {object} Modified building properties
   */
  applyBuildingHooks(building, metrics) {
    let result = { ...building }
    for (const hook of this.hooks.get('modifyBuilding')) {
      try {
        const modified = hook(result, metrics)
        if (modified) result = modified
      } catch (err) {
        console.warn(`[GitCity] Plugin error in modifyBuilding:`, err.message)
      }
    }
    return result
  }

  /**
   * Apply all modifyCity hooks.
   *
   * @param {object} city - City layout data
   * @param {Array} buildings - All building objects
   * @returns {object} Modified city data
   */
  applyCityHooks(city, buildings) {
    let result = { ...city }
    for (const hook of this.hooks.get('modifyCity')) {
      try {
        const modified = hook(result, buildings)
        if (modified) result = modified
      } catch (err) {
        console.warn(`[GitCity] Plugin error in modifyCity:`, err.message)
      }
    }
    return result
  }

  /**
   * Collect overlay layers from all plugins.
   *
   * @param {object} scene - Scene context
   * @param {object} data - City data
   * @returns {Array<object>} Array of overlay layer configs
   */
  collectOverlayLayers(scene, data) {
    const layers = []
    for (const hook of this.hooks.get('addOverlayLayer')) {
      try {
        const layer = hook(scene, data)
        if (layer) layers.push(layer)
      } catch (err) {
        console.warn(`[GitCity] Plugin error in addOverlayLayer:`, err.message)
      }
    }
    return layers
  }

  /**
   * Collect metrics from all metric providers.
   *
   * @param {string} username
   * @returns {Promise<object>} Merged metrics from all providers
   */
  async collectMetrics(username) {
    const merged = {}
    for (const hook of this.hooks.get('addMetricProvider')) {
      try {
        const metrics = await hook(username)
        if (metrics) Object.assign(merged, metrics)
      } catch (err) {
        console.warn(`[GitCity] Plugin error in addMetricProvider:`, err.message)
      }
    }
    return merged
  }

  /**
   * Reset — unregister all plugins.
   */
  reset() {
    for (const name of [...this.plugins.keys()]) {
      this.unregisterPlugin(name)
    }
  }
}

/**
 * Factory function to create a new PluginManager instance.
 *
 * @returns {PluginManager}
 */
export function createPluginManager() {
  return new PluginManager()
}
