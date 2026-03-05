# API Overview

GitCity exposes a REST API for accessing city data, user metrics, and trending developers.

## Base URL

```
http://localhost:5000
```

## Authentication

Most endpoints work without authentication, but logged-in users get:
- Higher GitHub API rate limits (5,000 vs 60 requests/hour)
- Access to personal city data and snapshots

Authentication uses GitHub OAuth + JWT tokens. See [Authentication](/api/authentication).

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/github` | — | Start OAuth flow |
| GET | `/auth/github/callback` | — | OAuth callback |
| GET | `/auth/me` | Required | Current user profile |
| POST | `/auth/logout` | Required | Clear session |
| GET | `/api/user/:username` | Optional | User data + metrics |
| GET | `/api/city` | Required | Personal city |
| POST | `/api/city/save` | Required | Save city snapshot |
| GET | `/api/city/history` | Required | Snapshot history |
| GET | `/api/city/multi` | Optional | Multi-user city |
| GET | `/api/trending` | Optional | Trending users |
| GET | `/api/metrics/:username` | Optional | Detailed metrics |
| GET | `/api/health` | — | Health check |

## Response Format

All responses are JSON. Errors follow this format:

```json
{
  "error": "Error message description"
}
```

## Rate Limiting

- Unauthenticated: 60 GitHub API calls/hour
- Authenticated: 5,000 GitHub API calls/hour
- Redis caching reduces actual API calls (10-minute TTL)
