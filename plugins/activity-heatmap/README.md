# Activity Heatmap Plugin

Colorizes buildings with a heatmap gradient based on commit activity.

## Color Ramp

| Activity | Commits | Color |
|----------|---------|-------|
| Low | < 50 | 🔵 Blue |
| Medium | 50 - 500 | 🟢 Green |
| High | 500 - 2000 | 🟡 Yellow |
| Very High | 2000+ | 🔴 Red |

## Usage

```js
import { activityHeatmapPlugin } from '@gitcity/plugin-activity-heatmap'

pluginManager.registerPlugin(activityHeatmapPlugin)
```
