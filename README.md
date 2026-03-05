# 🏙️ GitCity

**Turn any GitHub profile into a living 3D city.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

GitCity transforms GitHub contribution data into an interactive WebGL cityscape where every repository becomes a building — height from commits, width from stars, glow from recent activity.

<p align="center">
  <strong>10,000+ buildings • 60fps • Custom shaders • Plugin system</strong>
</p>

---

## Features

- **WebGL City Engine** — Instanced Three.js rendering with LOD, frustum culling, and spatial chunking
- **Custom GLSL Shaders** — Window flicker, heatmap glow, day/night cycle, 3-tier LOD
- **Plugin System** — Extend cities with `modifyBuilding`, `modifyCity`, `addOverlayLayer`, `addMetricProvider` hooks
- **SaaS Backend** — Express 5, PostgreSQL, Redis, GitHub OAuth, JWT auth
- **Embeddable SDK** — Drop a 3D city into any website with `<script>` or iframe
- **Public API** — `/api/trending`, `/api/metrics/:username` for programmatic access

## Quick Start

```bash
# Clone the repo
git clone https://github.com/gitcity/GitCity.git
cd GitCity

# Run automated setup
node scripts/setup.js

# Start development (backend + frontend)
node scripts/dev.js
```

**Backend** → `http://localhost:5000`  ·  **Frontend** → `http://localhost:5173`

## Architecture

```
GitCity/
├── frontend/          React + Three.js WebGL application
├── backend/           Express 5 API server (Prisma, Redis, JWT)
├── engine/            @gitcity/engine — standalone city engine
├── plugins/           Official plugins (language-colors, activity-heatmap, team-clusters)
├── sdk/               gitcity-sdk — embeddable city widget
├── docs/              VitePress documentation site
├── examples/          Example projects (simple-city, team-dashboard, activity-visualizer)
└── scripts/           Setup and dev scripts
```

## Plugins

Extend cities with zero friction:

```javascript
import { createPluginManager } from '@gitcity/engine/plugins'
import { languageColorPlugin } from 'gitcity-plugin-language-colors'

const pm = createPluginManager()
pm.registerPlugin(languageColorPlugin)
```

**Official Plugins:**

| Plugin | Description |
|--------|-------------|
| `language-colors` | Color buildings by primary language |
| `activity-heatmap` | Heat glow based on recent commit frequency |
| `team-clusters` | Group buildings by GitHub organization |

See the [Plugin Development Guide](docs/plugins/development.md) to create your own.

## SDK

Embed a 3D city anywhere:

```html
<script type="module">
  import { GitCity } from 'gitcity-sdk'

  const city = new GitCity({
    container: '#city',
    username: 'torvalds',
    apiBase: 'https://api.gitcity.dev',
  })
  city.render()
</script>
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Service health check |
| `GET /api/trending` | Trending developer cities |
| `GET /api/metrics/:username` | Detailed metrics + building dimensions |
| `POST /auth/github` | GitHub OAuth login |
| `GET /api/user/me` | Current user profile |
| `GET /api/city/:username` | Saved city snapshot |

## Documentation

Full documentation at the [docs site](docs/index.md) — or run locally:

```bash
cd docs && npm run dev
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the full vision — from real-time cities to the developer metaverse.

## License

[MIT](LICENSE)