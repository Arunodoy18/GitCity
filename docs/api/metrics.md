# Metrics API

## GET /api/metrics/:username

Returns detailed metrics for a GitHub user including building dimensions and history.

**Auth:** Optional

**Example:**
```
GET /api/metrics/sindresorhus
```

**Response:**
```json
{
  "username": "sindresorhus",
  "displayName": "Sindre Sorhus",
  "avatarUrl": "...",
  "metrics": {
    "commits": 15000,
    "repos": 1100,
    "stars": 120000,
    "commitScore": 87.5,
    "repoScore": 95.2,
    "starScore": 93.8,
    "followerScore": 82.4,
    "activityScore": 89.7,
    "totalStars": 120000,
    "totalForks": 18000,
    "topLanguage": "JavaScript",
    "recentActivity": true,
    "estimatedTotalCommits": 15000
  },
  "building": {
    "height": 60.0,
    "width": 8.0,
    "glowIntensity": 0.8
  },
  "history": [
    {
      "commits": 14800,
      "repos": 1095,
      "stars": 119500,
      "activityScore": 89.2,
      "topLanguage": "JavaScript",
      "recentActivity": true,
      "updatedAt": "2024-01-14T10:00:00Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Metrics Computation

Metrics use logarithmic scaling:

| Metric | Formula | Scale |
|--------|---------|-------|
| commitScore | `log2(commits + 1) * 8` | 0 - 100 |
| repoScore | `log2(repos + 1) * 12` | 0 - 100 |
| starScore | `log2(stars + 1) * 10` | 0 - 100 |
| followerScore | `log2(followers + 1) * 8` | 0 - 100 |
| activityScore | `commits*0.5 + repos*0.3 + stars*0.2` | Composite |

## Building Dimensions

| Dimension | From | Range |
|-----------|------|-------|
| Height | commits / 50 | 1 - 60 |
| Width | repos * 0.5 | 1 - 8 |
| Glow | recentActivity | 0 or 0.8 |
