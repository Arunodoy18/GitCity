/**
 * Language Color Plugin — Maps programming language to building color
 *
 * Uses GitHub's official language color palette.
 * Buildings are tinted based on the developer's top language.
 *
 * @example
 * import { languageColorPlugin } from '@gitcity/plugins/language-colors'
 * pluginManager.registerPlugin(languageColorPlugin)
 */

/**
 * GitHub's official language colors.
 * Source: https://github.com/ozh/github-colors
 */
export const LANGUAGE_COLORS = {
  JavaScript:  '#f1e05a',
  TypeScript:  '#3178c6',
  Python:      '#3572A5',
  Java:        '#b07219',
  'C++':       '#f34b7d',
  C:           '#555555',
  'C#':        '#178600',
  Go:          '#00ADD8',
  Rust:        '#dea584',
  Ruby:        '#701516',
  PHP:         '#4F5D95',
  Swift:       '#F05138',
  Kotlin:      '#A97BFF',
  Dart:        '#00B4AB',
  Shell:       '#89e051',
  Lua:         '#000080',
  R:           '#198CE7',
  Scala:       '#c22d40',
  Haskell:     '#5e5086',
  Elixir:      '#6e4a7e',
  Clojure:     '#db5855',
  Perl:        '#0298c3',
  Zig:         '#ec915c',
  Nim:         '#ffc200',
  Julia:       '#a270ba',
  OCaml:       '#3be133',
  Erlang:      '#B83998',
  Vue:         '#41b883',
  Svelte:      '#ff3e00',
  HTML:        '#e34c26',
  CSS:         '#563d7c',
  SCSS:        '#c6538c',
}

/**
 * Parse hex color string to { r, g, b } (0-1 range).
 */
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  }
}

export const languageColorPlugin = {
  name: 'language-colors',
  version: '1.0.0',
  description: 'Tints buildings based on the developer\'s top programming language',

  /**
   * modifyBuilding — Override building color when language is known.
   *
   * @param {object} building - Building props (height, width, color, etc.)
   * @param {object} metrics  - User metrics including `language`
   * @returns {object} Modified building
   */
  modifyBuilding(building, metrics) {
    if (!metrics || !metrics.language) return building

    const hex = LANGUAGE_COLORS[metrics.language]
    if (!hex) return building

    const rgb = hexToRgb(hex)

    return {
      ...building,
      // Blend: 70% language color, 30% original for variety
      color: `#${hex.replace('#', '')}`,
      baseColor: {
        r: rgb.r * 0.7 + (building.baseColor?.r || 0.1) * 0.3,
        g: rgb.g * 0.7 + (building.baseColor?.g || 0.1) * 0.3,
        b: rgb.b * 0.7 + (building.baseColor?.b || 0.1) * 0.3,
      },
      _languageColor: hex,
    }
  },
}

export default languageColorPlugin
