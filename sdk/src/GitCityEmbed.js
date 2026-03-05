/**
 * GitCityEmbed — Lightweight iframe-based embed for GitCity
 *
 * For scenarios where you don't want to bundle Three.js,
 * this creates an iframe pointing to the hosted GitCity app.
 *
 * @example
 * const embed = new GitCityEmbed({
 *   username: 'torvalds',
 *   appUrl: 'https://gitcity.dev',
 * })
 * embed.mount('#container')
 */

export class GitCityEmbed {
  /**
   * @param {object} options
   * @param {string} options.username - GitHub username
   * @param {string} [options.appUrl='https://gitcity.dev'] - Hosted GitCity URL
   * @param {number} [options.width] - Iframe width
   * @param {number} [options.height=500] - Iframe height
   * @param {string} [options.theme='dark'] - 'dark' or 'light'
   * @param {boolean} [options.controls=true] - Show navigation controls
   */
  constructor(options = {}) {
    this.options = {
      appUrl: 'https://gitcity.dev',
      height: 500,
      theme: 'dark',
      controls: true,
      ...options,
    }
    this.iframe = null
  }

  /**
   * Build the embed URL with query parameters.
   * @returns {string}
   */
  buildUrl() {
    const { appUrl, username, theme, controls } = this.options
    const params = new URLSearchParams({
      embed: 'true',
      theme,
      controls: controls ? '1' : '0',
    })
    if (username) params.set('user', username)
    return `${appUrl}?${params}`
  }

  /**
   * Mount the embed iframe into a container.
   * @param {string|HTMLElement} target - CSS selector or DOM element
   * @returns {GitCityEmbed}
   */
  mount(target) {
    const container = typeof target === 'string'
      ? document.querySelector(target)
      : target

    if (!container) {
      throw new Error(`GitCityEmbed: Container "${target}" not found`)
    }

    this.iframe = document.createElement('iframe')
    this.iframe.src = this.buildUrl()
    this.iframe.style.width = this.options.width ? `${this.options.width}px` : '100%'
    this.iframe.style.height = `${this.options.height}px`
    this.iframe.style.border = 'none'
    this.iframe.style.borderRadius = '12px'
    this.iframe.style.overflow = 'hidden'
    this.iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope'
    this.iframe.title = `GitCity - ${this.options.username || 'visualization'}`

    container.appendChild(this.iframe)
    return this
  }

  /**
   * Update the embed with new options.
   * @param {object} options
   */
  update(options) {
    Object.assign(this.options, options)
    if (this.iframe) {
      this.iframe.src = this.buildUrl()
    }
  }

  /**
   * Remove the embed from the DOM.
   */
  unmount() {
    if (this.iframe) {
      this.iframe.remove()
      this.iframe = null
    }
  }
}
