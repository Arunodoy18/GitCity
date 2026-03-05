# Users API

## GET /api/user/:username

Fetch a GitHub user's profile data and computed metrics.

**Auth:** Optional (higher rate limits when authenticated)

**Example:**
```
GET /api/user/torvalds
```

**Response:**
```json
{
  "username": "torvalds",
  "displayName": "Linus Torvalds",
  "avatarUrl": "https://avatars.githubusercontent.com/u/1024025",
  "bio": null,
  "repos": 7,
  "followers": 200000,
  "estimatedTotalCommits": 25000,
  "topLanguage": "C",
  "recentActivity": true,
  "totalStars": 50000,
  "metrics": {
    "commits": 25000,
    "repos": 7,
    "stars": 50000,
    "commitScore": 85.2,
    "repoScore": 22.4,
    "starScore": 78.6,
    "activityScore": 72.1
  }
}
```

## GET /api/user

Returns rate limit info for the current token.

**Response:**
```json
{
  "info": "GitCity User API",
  "rateLimit": {
    "limit": 5000,
    "remaining": 4987,
    "reset": 1709521200
  }
}
```
