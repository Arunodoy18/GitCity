# Trending API

## GET /api/trending

Returns trending GitHub users with their city metrics.

**Auth:** Optional (higher rate limits when authenticated)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `language` | string | `all` | Filter by language |
| `since` | string | `daily` | Time range |
| `limit` | number | `20` | Max results (up to 50) |

**Example:**
```
GET /api/trending?limit=5
```

**Response:**
```json
{
  "trending": [
    {
      "username": "torvalds",
      "displayName": "Linus Torvalds",
      "avatarUrl": "...",
      "bio": null,
      "language": "C",
      "metrics": {
        "commits": 25000,
        "repos": 7,
        "stars": 50000,
        "activityScore": 72.1
      }
    }
  ],
  "since": "daily",
  "language": "all",
  "count": 5,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Caching:** Results are cached for 30 minutes.
