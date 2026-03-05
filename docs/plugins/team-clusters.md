# Team Clusters Plugin

Groups developers from the same GitHub organization into distinct city districts.

## Installation

```js
import { teamClustersPlugin } from '@gitcity/plugin-team-clusters'
pluginManager.registerPlugin(teamClustersPlugin)
```

## Features

- **Organization detection** — reads `company` or `organization` from metrics
- **Brand colors** — Google, Microsoft, Meta, Apple, Amazon, etc.
- **Auto-coloring** — Unknown orgs get deterministic hash-based colors
- **District clustering** — `modifyCity` sorts org members adjacent
- **Legend overlay** — Shows top 10 organizations and their colors

## Known Organizations

Google, Microsoft, Meta, Apple, Amazon, Netflix, Twitter/X, Vercel, GitHub, Mozilla, Red Hat, Shopify, Stripe, Cloudflare, Automattic, HashiCorp
