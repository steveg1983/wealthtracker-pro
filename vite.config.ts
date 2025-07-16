import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // This will listen on all interfaces
    port: 5173,
    strictPort: true,
    open: false
  },
  build: {
    // Increase chunk size warning limit slightly since we're now splitting
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Manual chunks for better caching
        manualChunks: {
          // Group vendor libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['recharts', 'react-chartjs-2', 'chart.js'],
          'ui-vendor': ['lucide-react', '@dnd-kit/core', '@dnd-kit/sortable', 'react-grid-layout'],
          // Group utility libraries
          'utils': ['uuid', '@supabase/supabase-js']
        }
      }
    }
  }
})
