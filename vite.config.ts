import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteCSPPlugin } from './src/security/csp'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react()
    // CSP plugin temporarily disabled for debugging
    // process.env.NODE_ENV === 'production' && viteCSPPlugin()
  ].filter(Boolean),
  server: {
    host: true, // Allow external connections
    port: 8080,
    strictPort: false,
    open: false
  },
  preview: {
    host: true, // Listen on all interfaces for CI
    port: 4173,
    strictPort: true,
    open: false
  },
  build: {
    // Increase chunk size warning limit slightly since we're now splitting
    chunkSizeWarningLimit: 600,
    // Enable minification and tree shaking
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
      output: {
        // Manual chunks for better caching
        manualChunks: (id) => {
          // Core React dependencies
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') || 
              id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          
          // Charts and data visualization
          if (id.includes('recharts') || 
              id.includes('react-chartjs-2') || 
              id.includes('chart.js')) {
            return 'chart-vendor';
          }
          
          // UI libraries and icons
          if (id.includes('lucide-react') || 
              id.includes('@dnd-kit') || 
              id.includes('react-grid-layout') ||
              id.includes('react-window') ||
              id.includes('react-virtualized')) {
            return 'ui-vendor';
          }
          
          // Date utilities
          if (id.includes('date-fns')) {
            return 'date-vendor';
          }
          
          // Form and validation
          if (id.includes('react-hook-form') || 
              id.includes('zod')) {
            return 'form-vendor';
          }
          
          // Financial calculations
          if (id.includes('decimal.js')) {
            return 'math-vendor';
          }
          
          // Utilities
          if (id.includes('uuid') || 
              id.includes('lodash') ||
              id.includes('papaparse')) {
            return 'utils';
          }
          
          // Large libraries get their own chunks
          if (id.includes('tesseract.js')) {
            return 'ocr-vendor';
          }
          
          if (id.includes('xlsx')) {
            return 'xlsx'; // Separate chunk for XLSX
          }
          
          if (id.includes('html2canvas') || 
              id.includes('jspdf')) {
            return 'export-vendor';
          }
        },
        // Optimize chunk names
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `assets/${chunkInfo.name}-${facadeModuleId}-[hash].js`;
        }
      }
    },
    // Enable source maps for better debugging
    sourcemap: true
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'recharts',
      'decimal.js',
      'date-fns',
      'react-window'
    ]
  }
})
