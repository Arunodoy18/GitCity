# SDK Usage

The GitCity SDK lets you embed 3D GitHub city visualizations in any website.

## Installation

```bash
npm install gitcity-sdk
```

## Quick Start

```js
import { GitCity } from 'gitcity-sdk'

const city = new GitCity({
  username: 'arunodoy',
  apiUrl: 'http://localhost:5000',
})

await city.render('#city-container')
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `username` | string | — | GitHub username |
| `users` | string[] | — | Multiple usernames |
| `apiUrl` | string | `http://localhost:5000` | API URL |
| `controls` | boolean | `true` | Enable controls |
| `autoRotate` | boolean | `false` | Auto-rotate camera |
| `theme` | object | `{}` | Theme overrides |
| `width` | number | container | Canvas width |
| `height` | number | container | Canvas height |

## Events

```js
city.on('loaded', (data) => {
  console.log('City loaded with', data)
})

city.on('buildingClick', (user) => {
  console.log('Clicked:', user.username)
})

city.on('error', (err) => {
  console.error('Error:', err)
})
```

## Updating

```js
await city.update({ username: 'newuser' })
```

## Cleanup

```js
city.dispose()
```

## Lightweight Embed

For sites that don't want to bundle Three.js:

```js
import { GitCityEmbed } from 'gitcity-sdk'

const embed = new GitCityEmbed({
  username: 'torvalds',
  appUrl: 'https://gitcity.dev',
  height: 500,
})

embed.mount('#container')
```
