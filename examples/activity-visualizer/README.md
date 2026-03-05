# Activity Visualizer Example

Deep-dive into a single developer's GitHub activity with detailed metrics and a 3D city view.

## Run

1. Start the backend: `cd ../../backend && npm run dev`
2. Open `index.html` in a browser
3. Enter a GitHub username and click "Analyze"

## What it demonstrates

- Fetching from `/api/metrics/:username` endpoint
- Rendering detailed metric cards (commits, repos, stars, score)
- Building dimension calculations
- Metrics history visualization
