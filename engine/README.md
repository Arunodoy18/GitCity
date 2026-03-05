# @gitcity/engine

Core 3D city rendering engine for GitCity — turns GitHub metrics into a 3D city.

## Modules

| Module | Purpose |
|--------|---------|
| `layout` | City grid/radial positioning algorithms |
| `building` | Metrics → visual property mapping |
| `shaders` | Production-grade GLSL with LOD |
| `chunking` | Spatial partitioning for frustum culling |
| `plugins` | Extensible hook-based plugin system |

## Quick Start

```js
import {
  computePositions,
  generateBuildingProps,
  createPluginManager,
} from '@gitcity/engine'

// Position buildings on a grid
const positions = computePositions(users)

// Convert metrics to 3D properties
const props = generateBuildingProps({
  commits: 1200,
  repos: 45,
  recentActivity: true,
})

// Register plugins
const plugins = createPluginManager()
plugins.registerPlugin(myPlugin)
const modified = plugins.applyBuildingHooks(props, metrics)
```

## Plugin API

See [Plugin Development Guide](../docs/plugin-development.md) for full documentation.

```js
plugins.registerPlugin({
  name: 'my-plugin',
  version: '1.0.0',
  modifyBuilding(building, metrics) {
    // Customize building appearance
    return building
  },
  modifyCity(city, buildings) {
    // Customize city layout
    return city
  },
})
```
