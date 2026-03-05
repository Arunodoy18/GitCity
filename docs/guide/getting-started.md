# Getting Started

GitCity turns GitHub profiles into 3D cities. Each developer becomes a building — height from commits, width from repos, glow from recent activity.

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/ArunodaySingh/GitCity.git
cd GitCity
```

### 2. Install dependencies

```bash
# Frontend
cd frontend && npm install

# Backend
cd ../backend && npm install

# Generate database client
npx prisma generate
```

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit .env with your GitHub OAuth credentials
```

### 4. Start development

```bash
# Terminal 1 — Backend (port 5000)
cd backend && npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

### 5. Open your browser

Navigate to `http://localhost:5173` — you should see a 3D city with 10,000 buildings.

## Project Structure

```
gitcity/
├── frontend/       # WebGL city renderer (Vite + React + Three.js)
├── backend/        # SaaS API (Express + Prisma + Redis)
├── engine/         # Core 3D rendering engine (standalone)
├── plugins/        # Community plugins
├── sdk/            # Embeddable SDK
├── examples/       # Example projects
├── docs/           # This documentation site
└── scripts/        # Setup and deployment scripts
```

## Requirements

- Node.js 18+
- PostgreSQL 14+ (for backend persistence)
- Redis (optional — falls back to in-memory cache)
- GitHub OAuth App (for authentication)
