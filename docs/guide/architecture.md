# Architecture

GitCity is a modular system with clear separation of concerns.

## High-Level Diagram

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  Vite + React + Three.js + R3F + Drei           │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │ CityMgr  │ │ Shaders  │ │ Auth + UI    │    │
│  │ 10K inst │ │ LOD/Flkr │ │ OAuth panel  │    │
│  └──────────┘ └──────────┘ └──────────────┘    │
└───────────────────────┬─────────────────────────┘
                        │ REST API
┌───────────────────────▼─────────────────────────┐
│                   Backend                        │
│  Express 5 + Prisma + Redis                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │ Auth     │ │ Metrics  │ │ GitHub API   │    │
│  │ OAuth+JWT│ │ Engine   │ │ Service      │    │
│  └──────────┘ └──────────┘ └──────────────┘    │
│  ┌──────────┐ ┌──────────┐                      │
│  │ Cron Job │ │ Cache    │                      │
│  │ 10min    │ │ Redis/Mem│                      │
│  └──────────┘ └──────────┘                      │
└───────────────────────┬─────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │PostgreSQL│  │  Redis   │  │ GitHub   │
    │ Prisma   │  │  Cache   │  │ API v3   │
    └──────────┘  └──────────┘  └──────────┘
```

## Frontend Architecture

The frontend is built with Vite 8 + React 19 + Three.js (via React Three Fiber).

### Key Modules

| Module | Responsibility |
|--------|---------------|
| `SceneManager` | Three.js scene, fog, lighting |
| `RendererManager` | WebGL renderer, post-processing |
| `CityManager` | City layout, radial falloff, chunk orchestration |
| `InstancedBuildings` | 10K+ instanced buildings with custom shaders |
| `ControlManager` | Orbit + Fly camera modes |
| `useChunking` | Spatial grid partitioning for frustum culling |

### Shader Pipeline

Buildings use a custom GLSL shader with:
- **3-tier LOD**: Near (full effects), Mid (simplified), Far (flat silhouette)
- **Window flicker**: Pseudo-random animated windows at night
- **Heatmap overlay**: Commit-based color gradient
- **Day/Night cycle**: Smooth lighting transitions

## Backend Architecture

Express 5 with modular route handlers.

### API Routes

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/github` | GET | — | OAuth redirect |
| `/auth/github/callback` | GET | — | OAuth callback |
| `/auth/me` | GET | Required | Get current user |
| `/api/user/:username` | GET | Optional | User data + metrics |
| `/api/city` | GET | Required | Personal city |
| `/api/city/save` | POST | Required | Save snapshot |
| `/api/city/multi` | GET | Optional | Multi-user city |
| `/api/trending` | GET | Optional | Trending users |
| `/api/metrics/:username` | GET | Optional | Detailed metrics |

### Data Flow

1. User searches for a GitHub username
2. Backend checks Redis cache → fetches from GitHub API if miss
3. Metrics engine computes scores (log-scale)
4. Results cached for 10 minutes
5. Background cron refreshes metrics for all registered users

## Plugin System

The engine exposes 4 hook types:

```
registerPlugin()      → register a plugin
modifyBuilding()      → alter individual building props
modifyCity()          → alter city layout
addOverlayLayer()     → inject custom overlay layers
addMetricProvider()   → supply additional metrics
```

Plugins run in registration order. Each hook receives the current state and returns a modified version.
