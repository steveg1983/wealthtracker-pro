import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Safari-specific Vite configuration
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', // Use IP instead of localhost for Safari
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
      port: 5173,
      clientPort: 5173,
      // Disable HMR for Safari if needed
      // overlay: false
    }
  },
  // Disable some optimizations that might cause issues in Safari
  optimizeDeps: {
    exclude: ['@vite/client']
  },
  build: {
    target: 'es2015', // Better Safari compatibility
    sourcemap: false
  }
})