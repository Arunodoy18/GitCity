# Team Clusters Plugin

Groups developers from the same GitHub organization into distinct "districts" within the city.

## Known Organizations

Google, Microsoft, Meta, Apple, Amazon, Netflix, Vercel, GitHub, Mozilla, Shopify, Stripe, Cloudflare, and more — each with their brand color.

Unknown organizations get a unique deterministic color based on name hash.

## Features

- Tints buildings by organization color
- Sorts city layout to cluster org members together
- Provides district legend overlay for the UI

## Usage

```js
import { teamClustersPlugin } from '@gitcity/plugin-team-clusters'

pluginManager.registerPlugin(teamClustersPlugin)
```
