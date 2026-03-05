import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Code-split Three.js into its own chunk to stay under 500 kB per chunk

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Three.js is ~1.1 MB minified — this is inherent to WebGL; suppress nuisance warning
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'vendor-three'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react'
        },
      },
    },
  },
})
