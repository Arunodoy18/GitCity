# Contributing to GitCity

Thank you for your interest in contributing to GitCity! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Creating Plugins](#creating-plugins)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

By participating in this project, you agree to be respectful and constructive. We are committed to providing a welcoming and inclusive experience for everyone.

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9.0.0
- **Git**
- **PostgreSQL** (optional — SQLite fallback planned)
- **Redis** (optional — in-memory fallback available)

### Setup

```bash
# 1. Fork and clone the repo
git clone https://github.com/<your-username>/GitCity.git
cd GitCity

# 2. Run the automated setup
node scripts/setup.js

# 3. Start dev mode (backend + frontend concurrently)
node scripts/dev.js
```

This will start:
- **Backend** on `http://localhost:5000`
- **Frontend** on `http://localhost:5173`

### Manual Setup

If you prefer manual setup:

```bash
# Frontend
cd frontend && npm install

# Backend
cd backend && npm install && npx prisma generate

# Engine (standalone module)
cd engine && npm install

# Documentation
cd docs && npm install
```

## Development Workflow

### Branching Strategy

We use a **feature branch** workflow:

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code, always deployable |
| `develop` | Integration branch for features |
| `feature/<name>` | New feature development |
| `fix/<name>` | Bug fixes |
| `plugin/<name>` | New plugin development |
| `docs/<name>` | Documentation updates |

### Steps

1. Create a branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-awesome-feature
   ```

2. Make your changes with clear, atomic commits:
   ```bash
   git commit -m "feat: add building animation system"
   ```

3. Push and open a Pull Request against `develop`.

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Usage |
|--------|-------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `style:` | Formatting, no code change |
| `refactor:` | Code restructuring |
| `perf:` | Performance improvement |
| `test:` | Adding or updating tests |
| `chore:` | Build process or tooling |
| `plugin:` | Plugin-related changes |

## Project Structure

```
GitCity/
├── frontend/          # React + Three.js WebGL application
│   └── src/
│       ├── city/      # City rendering (CityManager, Buildings, Floor)
│       ├── data/      # Data fetching, caching, auth
│       ├── ui/        # UI components (HUD, panels, controls)
│       └── shaders/   # GLSL shader modules
├── backend/           # Express 5 API server
│   ├── routes/        # API route handlers
│   ├── middleware/     # Auth, rate-limiting, error handling
│   ├── services/      # Business logic (metrics, cache, jobs)
│   └── prisma/        # Database schema and migrations
├── engine/            # @gitcity/engine — standalone city engine
│   └── src/           # Layout, building, shaders, chunking, plugins
├── plugins/           # Official plugins
│   ├── language-colors/
│   ├── activity-heatmap/
│   └── team-clusters/
├── sdk/               # gitcity-sdk — embeddable widget
│   └── src/           # GitCity, GitCityEmbed classes
├── docs/              # VitePress documentation site
├── examples/          # Example projects
└── scripts/           # Setup and dev scripts
```

## Code Style

### General

- **ES Modules** (`import`/`export`) everywhere
- **No semicolons** (we use a minimal style)
- **Single quotes** for strings
- **2-space indentation**
- **Trailing commas** in multi-line structures
- **`const`** by default; `let` only when reassignment is needed

### Frontend (React)

- Functional components only — no class components
- Hooks for all state and side effects
- Three.js objects use `useRef` + `useFrame` pattern
- Memoize expensive computations with `useMemo`

### Backend (Express)

- Async route handlers with proper error boundaries
- All routes return JSON with consistent shape
- Use middleware for cross-cutting concerns (auth, rate limiting)

### Engine

- **Zero** React or framework dependencies
- Pure functions wherever possible
- Three.js is a **peer dependency** — never bundle it

### Shaders (GLSL)

- Comment each uniform and varying
- Use `#define` for constants
- Keep vertex and fragment shaders in separate strings

## Pull Request Process

1. **Ensure your branch is up to date** with `develop`
2. **Self-review** your diff before opening the PR
3. **Fill out the PR template** with:
   - What changed and why
   - Screenshots/recordings for visual changes
   - Link to related issue(s)
4. **All checks must pass** (lint, build, tests)
5. **One approval** required from a maintainer
6. **Squash merge** into `develop`

### PR Checklist

- [ ] Code follows the project style guidelines
- [ ] Self-reviewed the code
- [ ] Added/updated documentation if needed
- [ ] Added/updated tests if applicable
- [ ] No console.log or debug artifacts left
- [ ] Tested locally with `node scripts/dev.js`

## Creating Plugins

Plugins are the best way to extend GitCity. See the [Plugin Development Guide](https://gitcity.dev/plugins/development) for full details.

### Quick Start

```bash
mkdir plugins/my-plugin
cd plugins/my-plugin
npm init -y
```

Create `index.js`:

```javascript
export const myPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Does something awesome',

  // Modify individual buildings
  modifyBuilding(building, metrics) {
    if (metrics.stars > 1000) {
      building.emissive = [1.0, 0.84, 0.0]
      building.emissiveIntensity = 0.5
    }
    return building
  },

  // Add overlay UI layers
  addOverlayLayer(scene, data) {
    return {
      id: 'my-overlay',
      label: 'My Overlay',
      data: { /* ... */ },
    }
  },
}
```

### Plugin Hooks

| Hook | Purpose | Signature |
|------|---------|-----------|
| `modifyBuilding` | Alter building appearance | `(building, metrics) → building` |
| `modifyCity` | Alter city-level layout | `(city, buildings) → city` |
| `addOverlayLayer` | Add UI overlays | `(scene, data) → layer` |
| `addMetricProvider` | Supply custom metrics | `(username) → Promise<metrics>` |

### Testing Your Plugin

```javascript
import { createPluginManager } from '@gitcity/engine/plugins'
import { myPlugin } from './index.js'

const pm = createPluginManager()
pm.registerPlugin(myPlugin)

const building = { height: 10, color: [0.5, 0.5, 0.5] }
const metrics = { stars: 2000 }
const result = pm.applyBuildingHooks(building, metrics)

console.log(result.emissive) // [1.0, 0.84, 0.0]
```

## Reporting Issues

### Bug Reports

Use the **Bug Report** issue template. Include:
- Steps to reproduce
- Expected vs. actual behavior
- Browser/OS/Node.js version
- Screenshots or console errors

### Feature Requests

Use the **Feature Request** issue template. Include:
- Problem description
- Proposed solution
- Alternatives considered

### Plugin Ideas

Use the **Plugin Idea** issue template to propose new official plugins.

---

## Questions?

- Open a [Discussion](https://github.com/gitcity/GitCity/discussions)
- Read the [Documentation](https://gitcity.dev)
- Check existing [Issues](https://github.com/gitcity/GitCity/issues)

Thank you for helping make GitCity better! 🏙️
