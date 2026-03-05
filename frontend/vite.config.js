import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Code-split Three.js into its own chunk to stay under 500 kB per chunk

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Three.js is ~1.1 MB minified — this is inherent to WebGL; suppress nuisance warning
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-three',
              test: /three/,
              priority: 10,
            },
            {
              name: 'vendor-react',
              test: /react|react-dom|scheduler/,
              priority: 5,
            },
          ],
        },
      },
    },
  },
})
