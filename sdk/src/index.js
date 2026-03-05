/**
 * GitCity SDK — Embed 3D GitHub city visualizations in any website
 *
 * @example
 * import { GitCity } from 'gitcity-sdk'
 *
 * const city = new GitCity({
 *   username: 'arunodoy',
 *   apiUrl: 'https://api.gitcity.dev',
 * })
 *
 * city.render('#city-container')
 * city.on('buildingClick', (user) => console.log(user))
 */

export { GitCity } from './GitCity.js'
export { GitCityEmbed } from './GitCityEmbed.js'
export { VERSION } from './version.js'
