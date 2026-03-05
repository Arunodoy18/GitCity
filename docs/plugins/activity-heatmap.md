# Activity Heatmap Plugin

Colorizes buildings with a heatmap gradient based on commit activity.

## Installation

```js
import { activityHeatmapPlugin } from '@gitcity/plugin-activity-heatmap'
pluginManager.registerPlugin(activityHeatmapPlugin)
```

## Color Ramp

Using logarithmic normalization:

| Activity Level | Commits | Color | Glow |
|---------------|---------|-------|------|
| Very Low | < 10 | Deep Blue | 0.2 |
| Low | 10 - 100 | Blue | 0.5 |
| Medium | 100 - 500 | Green | 0.8 |
| High | 500 - 2000 | Yellow | 1.2 |
| Very High | 2000+ | Red | 1.7 |

## Features

- **Logarithmic scale** — Differences visible at all levels
- **Smooth gradient** — No harsh color transitions
- **Overlay legend** — Provides UI legend data via `addOverlayLayer`
