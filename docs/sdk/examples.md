# SDK Examples

## Single User City

```js
import { GitCity } from 'gitcity-sdk'

const city = new GitCity({
  username: 'torvalds',
  autoRotate: true,
})

await city.render('#container')
```

## Team City

```js
const city = new GitCity({
  users: ['torvalds', 'gaearon', 'sindresorhus', 'tj'],
  autoRotate: true,
})

await city.render('#container')

city.on('buildingClick', (user) => {
  showUserCard(user)
})
```

## Custom Theme

```js
const city = new GitCity({
  username: 'arunodoy',
  theme: {
    buildingColor: '#1a1a2e',
    groundColor: '#0f0f23',
    glowColor: '#e94560',
  },
})

await city.render('#container')
```

## React Integration

```jsx
import { useEffect, useRef } from 'react'
import { GitCity } from 'gitcity-sdk'

function CityViewer({ username }) {
  const containerRef = useRef(null)
  const cityRef = useRef(null)

  useEffect(() => {
    const city = new GitCity({ username, autoRotate: true })
    city.render(containerRef.current)
    cityRef.current = city

    return () => city.dispose()
  }, [username])

  return <div ref={containerRef} style={{ width: '100%', height: 500 }} />
}
```

## Vue Integration

```vue
<template>
  <div ref="container" style="width: 100%; height: 500px" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { GitCity } from 'gitcity-sdk'

const props = defineProps({ username: String })
const container = ref(null)
let city = null

onMounted(async () => {
  city = new GitCity({ username: props.username, autoRotate: true })
  await city.render(container.value)
})

onBeforeUnmount(() => city?.dispose())
</script>
```

See the [examples/](https://github.com/ArunodaySingh/GitCity/tree/main/examples) directory for full working projects.
