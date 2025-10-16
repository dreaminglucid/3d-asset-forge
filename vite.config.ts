import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['three'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      three: path.resolve(__dirname, 'node_modules/three')
    }
  },
  optimizeDeps: {
    // Avoid pre-bundling multiple copies of three
    exclude: ['three']
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/assets': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
