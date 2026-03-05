# Installation

## Prerequisites

| Dependency | Version | Required |
|-----------|---------|----------|
| Node.js | 18+ | ✅ |
| PostgreSQL | 14+ | ✅ (for backend) |
| Redis | 7+ | Optional |
| npm | 9+ | ✅ |

## Step-by-step

### 1. Clone

```bash
git clone https://github.com/ArunodaySingh/GitCity.git
cd GitCity
```

### 2. Setup script (recommended)

```bash
node scripts/setup.js
```

This will install all dependencies, set up the database, and configure environment variables interactively.

### 3. Manual setup

#### Frontend

```bash
cd frontend
npm install
```

#### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push    # Requires PostgreSQL
```

#### Engine (for contributors)

```bash
cd engine
npm install
```

#### Documentation site

```bash
cd docs
npm install
npm run dev
```

### 4. Environment variables

Create `backend/.env`:

```env
PORT=5000
FRONTEND_URL=http://localhost:5173
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
JWT_SECRET=your-secret-key
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gitcity
REDIS_URL=redis://localhost:6379
```

### 5. GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set callback URL to `http://localhost:5000/auth/github/callback`
4. Copy Client ID and Client Secret to `.env`

## Verify

```bash
# Backend health check
curl http://localhost:5000/api/health

# Frontend should open automatically at http://localhost:5173
```
