# GitCity Roadmap

> A living document tracking where GitCity has been and where it's heading.

---

## v1.0 — WebGL City Engine ✅

*The foundation: turn any GitHub profile into a 3D city.*

- [x] Three.js scene with camera controls (orbit, fly)
- [x] Instanced rendering for 10,000+ buildings at 60fps
- [x] Building dimensions derived from GitHub metrics (commits, stars, repos)
- [x] Custom GLSL shaders — LOD, window flicker, heatmap glow, day/night cycle
- [x] Frustum culling and spatial chunking for performance
- [x] City floor with animated grid
- [x] Responsive canvas with resize observer
- [x] HUD overlay with live FPS, building count, camera position

---

## v2.0 — SaaS Platform ✅

*User accounts, persistence, and a real API.*

- [x] Express 5 backend with structured routing
- [x] GitHub OAuth authentication (login with GitHub)
- [x] JWT session management with refresh tokens
- [x] PostgreSQL database via Prisma ORM
- [x] Redis caching layer (with in-memory fallback)
- [x] User profiles and city snapshots (save/load)
- [x] Rate limiting and security middleware
- [x] Background job system for data refresh
- [x] `/api/health`, `/api/user`, `/api/city` endpoints
- [x] Frontend auth integration (AuthPanel, useAuth hook)

---

## v3.0 — Open Source Ecosystem ✅

*Plugin architecture, SDK, docs, and community tooling.*

- [x] `@gitcity/engine` — standalone city engine package
  - Layout algorithms (grid, radial/spiral)
  - Building props generator (pure functions)
  - Shader extraction with material factory
  - Chunking system (framework-agnostic)
- [x] Plugin system with 4 hook types
  - `modifyBuilding` — alter building appearance
  - `modifyCity` — alter city layout
  - `addOverlayLayer` — add UI overlays
  - `addMetricProvider` — supply custom metrics
- [x] Official plugins: language-colors, activity-heatmap, team-clusters
- [x] `gitcity-sdk` — embeddable city widget (WebGL + iframe modes)
- [x] Public API: `/api/trending`, `/api/metrics/:username`
- [x] Example projects (simple-city, team-dashboard, activity-visualizer)
- [x] VitePress documentation site (19 pages across 4 sections)
- [x] CONTRIBUTING.md, issue templates, PR template
- [x] Setup and dev scripts for onboarding

---

## v4.0 — Real-Time Cities 🔮

*Live data, multiplayer, and dynamic visualizations.*

- [ ] **WebSocket live updates** — buildings grow/shrink as commits land in real time
- [ ] **Multiplayer presence** — see other visitors walking through your city
- [ ] **Commit rain** — animated particles falling onto buildings when pushes happen
- [ ] **PR bridges** — visual bridges between buildings representing pull requests
- [ ] **Issue markers** — floating icons above buildings showing open issue count
- [ ] **Activity timeline** — scrub through time to replay a city's growth history
- [ ] **Notification toasts** — real-time alerts for stars, forks, and follows
- [ ] **GitHub Webhooks** — push-based data instead of polling
- [ ] **Server-Sent Events** fallback for environments without WebSocket

---

## v5.0 — Developer Metaverse 🌐

*Cross-city exploration and social features.*

- [ ] **City teleportation** — fly from one user's city to another
- [ ] **Organization campuses** — combined cities for GitHub orgs
- [ ] **City comparison mode** — side-by-side city rendering
- [ ] **Minimap** — overhead radar view for navigation
- [ ] **Building interiors** — click a building to see repo details, file tree, README
- [ ] **Achievements & badges** — gamification for contribution milestones
- [ ] **Custom themes** — cyberpunk, nature, minimal, retro, etc.
- [ ] **City screenshots** — high-res export with watermark
- [ ] **Share links** — `gitcity.dev/u/username` with Open Graph previews
- [ ] **City embeds** — embed interactive cities in GitHub README, blogs, portfolios

---

## v6.0 — Analytics & Insights 📊

*Turn cities into actionable developer intelligence.*

- [ ] **Team health dashboards** — org-wide metrics aggregation
- [ ] **Contribution trends** — weekly/monthly/yearly growth charts
- [ ] **Bus factor analysis** — identify single points of failure in repos
- [ ] **Language drift** — track how a user's language usage changes over time
- [ ] **Collaboration graph** — 3D network of who works with whom
- [ ] **Benchmark mode** — compare metrics against percentiles
- [ ] **Export reports** — PDF/CSV export of city metrics
- [ ] **Slack/Discord integration** — weekly city snapshots to team channels

---

## v7.0 — Platform & Ecosystem 🏗️

*Beyond GitHub, beyond the browser.*

- [ ] **GitLab support** — render cities from GitLab profiles
- [ ] **Bitbucket support** — render cities from Bitbucket profiles
- [ ] **Desktop app** — Electron wrapper with system tray
- [ ] **Mobile app** — React Native with gyroscope city control
- [ ] **VS Code extension** — city view in the sidebar
- [ ] **CLI tool** — `npx gitcity username` renders in terminal (ASCII city)
- [ ] **Plugin marketplace** — discover and install community plugins
- [ ] **Plugin sandboxing** — run untrusted plugins safely
- [ ] **Theming API** — full visual customization system
- [ ] **i18n** — multilingual support

---

## How to Contribute to the Roadmap

This roadmap is community-driven. To propose changes:

1. **Open a Feature Request** issue using our template
2. **Start a Discussion** for broader ideas
3. **Submit a PR** to update this file directly

Items move from 🔮 to ✅ when merged into `main`.

---

*Last updated: 2025*
