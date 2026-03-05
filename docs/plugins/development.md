# Plugin Development Guide

This guide walks through creating a GitCity plugin from scratch.

## Plugin Structure

A plugin is a plain JavaScript object with a `name` and one or more hook functions:

```js
export const myPlugin = {
  name: 'my-awesome-plugin',    // Required: unique identifier
  version: '1.0.0',             // Optional: semver version
  description: 'Does something', // Optional: human-readable

  // Lifecycle
  init(pluginManager) { },       // Called on registration
  destroy() { },                 // Called on unregistration

  // Hooks (implement one or more)
  modifyBuilding(building, metrics) { return building },
  modifyCity(city, buildings) { return city },
  addOverlayLayer(scene, data) { return overlayConfig },
  addMetricProvider(username) { return extraMetrics },
}
```

## Step-by-Step: Building a "Star Rating" Plugin

Let's build a plugin that adds a star rating effect to popular repos.

### 1. Create the plugin directory

```
plugins/
  star-rating/
    index.js
    package.json
    README.md
```

### 2. Write the plugin

```js
// plugins/star-rating/index.js

export const starRatingPlugin = {
  name: 'star-rating',
  version: '1.0.0',
  description: 'Adds golden glow to high-star developers',

  modifyBuilding(building, metrics) {
    const stars = metrics.totalStars || metrics.stars || 0

    if (stars >= 10000) {
      // Legendary — intense golden glow
      return {
        ...building,
        emissive: { r: 1.0, g: 0.84, b: 0.0 },
        emissiveIntensity: 2.0,
        _starTier: 'legendary',
      }
    }

    if (stars >= 1000) {
      // Popular — warm glow
      return {
        ...building,
        emissive: { r: 1.0, g: 0.6, b: 0.0 },
        emissiveIntensity: 1.0,
        _starTier: 'popular',
      }
    }

    return building
  },

  addOverlayLayer(scene, data) {
    return {
      type: 'star-legend',
      position: 'bottom-right',
      items: [
        { label: '10K+ stars', color: '#FFD700', tier: 'legendary' },
        { label: '1K+ stars', color: '#FF9900', tier: 'popular' },
      ],
    }
  },
}

export default starRatingPlugin
```

### 3. Register it

```js
import { createPluginManager } from '@gitcity/engine'
import { starRatingPlugin } from './plugins/star-rating'

const pm = createPluginManager()
pm.registerPlugin(starRatingPlugin)

// Now when buildings are processed:
const enhancedBuilding = pm.applyBuildingHooks(building, metrics)
```

### 4. Create package.json

```json
{
  "name": "@gitcity/plugin-star-rating",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "peerDependencies": {
    "@gitcity/engine": "^1.0.0"
  }
}
```

## Hook Reference

### `modifyBuilding(building, metrics)`

Called once per building. Must return the (possibly modified) building object.

**building** properties:
- `height` (number) — Building height
- `width` (number) — Building width
- `depth` (number) — Building depth
- `baseColor` ({ r, g, b }) — RGB color (0-1)
- `emissive` ({ r, g, b }) — Glow color
- `emissiveIntensity` (number) — Glow strength

**metrics** properties:
- `commits` (number)
- `repos` (number)
- `stars` (number)
- `language` (string)
- `recentActivity` (boolean)
- `company` (string)

### `modifyCity(city, buildings)`

Called once with the full city and building array. Use for layout modifications.

### `addOverlayLayer(scene, data)`

Return an overlay config object. The frontend renders these as UI panels.

### `addMetricProvider(username)`

Async hook. Return additional metrics to merge into user data.

## Best Practices

1. **Always return** the modified object from hooks
2. **Don't mutate** — spread and create new objects
3. **Prefix custom properties** with `_` (e.g., `_starTier`)
4. **Handle missing data** — always check `if (!metrics)` 
5. **Keep it fast** — hooks run per-building, optimize for 10K+ calls
