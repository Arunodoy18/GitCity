# Plugin System Overview

GitCity's plugin system lets anyone extend the city without modifying core code.

## How Plugins Work

Plugins register hook functions that the engine calls at specific points during rendering:

```
User Data → generateBuildingProps() → [modifyBuilding hooks] → Final Building
City Data → computePositions()      → [modifyCity hooks]     → Final Layout
Render    →                         → [addOverlayLayer]      → Custom Overlays
API Call  →                         → [addMetricProvider]    → Extra Metrics
```

## Available Hooks

| Hook | When Called | Receives | Returns |
|------|-----------|----------|---------|
| `modifyBuilding` | Per building | `(building, metrics)` | Modified building |
| `modifyCity` | Once per render | `(city, buildings)` | Modified city |
| `addOverlayLayer` | After render | `(scene, data)` | Overlay config |
| `addMetricProvider` | Per user fetch | `(username)` | Extra metrics |

## Built-in Plugins

| Plugin | Description |
|--------|-------------|
| [Language Colors](/plugins/language-colors) | Tint buildings by programming language |
| [Activity Heatmap](/plugins/activity-heatmap) | Glow intensity from commit count |
| [Team Clusters](/plugins/team-clusters) | Group org members into districts |

## Quick Example

```js
import { createPluginManager } from '@gitcity/engine'

const plugins = createPluginManager()

plugins.registerPlugin({
  name: 'my-plugin',
  modifyBuilding(building, metrics) {
    if (metrics.commits > 1000) {
      building.emissiveIntensity = 1.5
    }
    return building
  }
})
```
