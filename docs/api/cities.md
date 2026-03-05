# Cities API

## GET /api/city

Get the authenticated user's personal city data.

**Auth:** Required

**Response:**
```json
{
  "user": {
    "username": "arunodoy",
    "avatarUrl": "...",
    "repos": 45
  },
  "repos": [...],
  "metrics": { ... },
  "latestSnapshot": { ... }
}
```

## POST /api/city/save

Save a city snapshot (layout + metrics at a point in time).

**Auth:** Required

**Body:**
```json
{
  "citySnapshot": { "buildings": [...], "layout": "grid" },
  "metricsData": { "totalBuildings": 45 }
}
```

**Response:**
```json
{
  "message": "City snapshot saved",
  "city": { "id": 1, "generatedAt": "..." }
}
```

## GET /api/city/history

Get the last 20 city snapshots.

**Auth:** Required

**Response:**
```json
{
  "history": [
    {
      "id": 1,
      "generatedAt": "2024-01-15T10:30:00Z",
      "metricsData": { ... }
    }
  ]
}
```

## GET /api/city/multi

Get a multi-user city view.

**Query:** `?users=torvalds&users=gaearon&users=sindresorhus`

**Auth:** Optional

**Response:**
```json
{
  "users": [
    { "username": "torvalds", "commits": 25000, "repos": 7, ... },
    { "username": "gaearon", "commits": 8000, "repos": 300, ... }
  ],
  "count": 2
}
```
