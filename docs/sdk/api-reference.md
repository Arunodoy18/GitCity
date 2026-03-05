# SDK API Reference

## GitCity

The main class for creating full 3D city visualizations.

### Constructor

```js
new GitCity(options)
```

### Methods

#### `render(target): Promise<GitCity>`

Render the city into a DOM element.

- `target` — CSS selector string or HTMLElement

#### `update(options): Promise<void>`

Update the city with new data. Removes existing buildings and re-fetches.

#### `on(event, callback): GitCity`

Listen for events. Returns `this` for chaining.

#### `off(event, callback): GitCity`

Remove an event listener.

#### `dispose(): void`

Destroy the city, free WebGL resources, and remove the canvas.

### Events

| Event | Data | Description |
|-------|------|-------------|
| `loaded` | User data | City data fetched and rendered |
| `error` | Error object | Fetch or render error |
| `buildingClick` | User object | User clicked a building |

---

## GitCityEmbed

Lightweight iframe-based embed.

### Constructor

```js
new GitCityEmbed(options)
```

| Option | Type | Default |
|--------|------|---------|
| `username` | string | — |
| `appUrl` | string | `https://gitcity.dev` |
| `width` | number | `100%` |
| `height` | number | `500` |
| `theme` | string | `dark` |
| `controls` | boolean | `true` |

### Methods

#### `mount(target): GitCityEmbed`

Mount the iframe into a DOM container.

#### `update(options): void`

Update embed URL with new options.

#### `unmount(): void`

Remove the iframe from the DOM.
