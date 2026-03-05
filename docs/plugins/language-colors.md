# Language Colors Plugin

Tints buildings based on the developer's top programming language using GitHub's official color palette.

## Installation

```js
import { languageColorPlugin } from '@gitcity/plugin-language-colors'
pluginManager.registerPlugin(languageColorPlugin)
```

## Supported Languages

| Language | Color | Hex |
|----------|-------|-----|
| JavaScript | Yellow | `#f1e05a` |
| TypeScript | Blue | `#3178c6` |
| Python | Blue | `#3572A5` |
| Java | Orange | `#b07219` |
| C++ | Pink | `#f34b7d` |
| Go | Cyan | `#00ADD8` |
| Rust | Peach | `#dea584` |
| Ruby | Red | `#701516` |
| PHP | Purple | `#4F5D95` |
| Swift | Orange | `#F05138` |
| Kotlin | Purple | `#A97BFF` |
| And 20+ more... | | |

## How It Works

When a building's metrics include a `language` field, the plugin:
1. Looks up the language in the GitHub color palette
2. Blends 70% language color with 30% original color
3. Returns the modified building with the new color

Buildings without a language use their default color.
