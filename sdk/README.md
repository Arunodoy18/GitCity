# GitCity SDK

Embed 3D GitHub city visualizations in any website.

## Installation

```bash
npm install gitcity-sdk
```

## Quick Start

### Full 3D City (WebGL)

```js
import { GitCity } from 'gitcity-sdk'

const city = new GitCity({
  username: 'arunodoy',
  apiUrl: 'http://localhost:5000',
  autoRotate: true,
})

await city.render('#city-container')

city.on('buildingClick', (user) => {
  console.log('Clicked:', user.username)
})
```

### Lightweight Embed (iframe)

```js
import { GitCityEmbed } from 'gitcity-sdk'

const embed = new GitCityEmbed({
  username: 'torvalds',
  appUrl: 'https://gitcity.dev',
  height: 500,
})

embed.mount('#embed-container')
```

## API Reference

### `new GitCity(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `username` | `string` | — | GitHub username to visualize |
| `users` | `string[]` | — | Multiple usernames for multi-city |
| `apiUrl` | `string` | `http://localhost:5000` | GitCity API URL |
| `controls` | `boolean` | `true` | Enable orbit controls |
| `autoRotate` | `boolean` | `false` | Auto-rotate camera |
| `theme` | `object` | `{}` | Color theme overrides |
| `width` | `number` | container width | Canvas width |
| `height` | `number` | container height | Canvas height |

### Methods

- `city.render(target)` — Render into a DOM element
- `city.update(options)` — Update city data
- `city.on(event, callback)` — Listen for events
- `city.off(event, callback)` — Remove listener
- `city.dispose()` — Clean up resources

### Events

- `loaded` — City data fetched and rendered
- `error` — Fetch or render error
- `buildingClick` — User clicked a building

## License

MIT
