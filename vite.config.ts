import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression2'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

// Feature flags (read at config time in Node)
const ANALYZE = !!process.env.ANALYZE_BUNDLE
const ENABLE_COMPRESS = process.env.ENABLE_ASSET_COMPRESSION !== 'false'

// https://vite.dev/config/
export default defineConfig({
  plugins: (
    () => {
      const plugins = [react({ 
        jsxRuntime: 'automatic',
        jsxImportSource: 'react'
      })]
      // Compress only during build, and only if enabled
      if (ENABLE_COMPRESS) {
        plugins.push(
          compression({ algorithms: ['gzip'], threshold: 1024, deleteOriginalAssets: false }) as any,
          compression({ algorithms: ['brotliCompress'], threshold: 1024, deleteOriginalAssets: false }) as any,
        )
      }
      // Bundle analyzer gated by env flag
      if (ANALYZE) {
        plugins.push(visualizer({ open: true, filename: 'bundle-stats.html', gzipSize: true, brotliSize: true }) as any)
      }
      return plugins
    }
  )(),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Fix for recharts es-toolkit import issue
      // This ensures recharts gets the correct export format
      'es-toolkit/compat/get': 'lodash-es/get'
    }
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    open: false,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    open: false
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    // World-class optimizations
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
      strictRequires: 'auto'
    },
    rollupOptions: {
      treeshake: {
        moduleSideEffects: true,
        propertyReadSideEffects: false
      },
      output: {
        // Aggressive chunking strategy to reduce bundle sizes
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          
          const module = id.replace(/.*node_modules\//, '').split('/')[0]
          
          // Core React - absolutely minimal
          if (['react', 'react-dom'].includes(module)) {
            return 'react-core'
          }
          
          // React ecosystem
          if (['react-router-dom', 'react-is', 'react-redux'].includes(module)) {
            return 'react-ecosystem'
          }
          
          // Redux
          if (module.startsWith('@reduxjs')) {
            return 'redux'
          }
          
          // Clerk auth (large library)
          if (module.startsWith('@clerk')) {
            return 'clerk'
          }
          
          // Supabase (large library)
          if (module.startsWith('@supabase')) {
            return 'supabase'
          }
          
          // UI libraries by size
          if (module.startsWith('@radix-ui')) return 'radix-ui'
          if (module.startsWith('@headlessui')) return 'headless-ui'
          if (module.startsWith('@tabler')) return 'tabler-icons'
          
          // Charts - each in separate chunk
          if (module === 'recharts') return 'recharts'
          if (module === 'd3-scale' || module === 'd3-shape' || module.startsWith('d3-')) return 'd3'
          // Disallow chunk rules for banned chart libs (plotly/chartjs)
          
          // Heavy libraries - always separate
          if (module === 'xlsx' || module === 'sheetjs-style') return 'xlsx'
          if (module === 'jspdf') return 'jspdf'
          if (module === 'html2canvas') return 'html2canvas'
          if (module.includes('tesseract')) return 'tesseract'
          
          // Date utilities
          if (module === 'date-fns') return 'date-fns'
          
          // Math libraries
          if (module === 'decimal.js' || module === 'decimal.js-light') return 'decimal'
          
          // Form libraries
          if (module === 'react-hook-form') return 'react-hook-form'
          
          // DnD
          if (module.includes('dnd-kit')) return 'dnd-kit'
          
          // Stripe
          if (module.startsWith('@stripe')) return 'stripe'
          
          // PDF reader
          if (module === 'pdf-parse' || module.includes('pdf')) return 'pdf-libs'
          
          // Sentry
          if (module.startsWith('@sentry')) return 'sentry'
          
          // Plaid
          if (module.includes('plaid')) return 'plaid'
          
          // Small utilities bundled together
          if (['clsx', 'tailwind-merge', 'class-variance-authority'].includes(module)) {
            return 'class-utils'
          }
          
          // Lodash and similar
          if (module.includes('lodash') || module === 'es-toolkit') {
            return 'lodash-utils'
          }
          
          // All other small vendor libraries
          return 'vendor-misc'
        },
        // Use content hash for better caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop()?.split('.')[0] : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        },
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Enable minification but preserve React (single source of truth)
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Strip specific console calls via pure_funcs below
        drop_debugger: true,
        // Remove non-critical console in production bundles while keeping warn/error
        // This keeps accessibility/error logs visible but drops noisy logs
        pure_funcs: ['console.debug', 'console.info', 'console.log'],
        passes: 2, // Balance between compression and build time
        inline: 2, // Inline functions
        // Safe optimizations only for financial app
        conditionals: true,
        comparisons: true,
        booleans: true,
        loops: true,
        unused: true,
        hoist_funs: true,
        if_return: true,
        join_vars: true,
        reduce_vars: true,
        collapse_vars: true,
        side_effects: true,
        dead_code: true
      },
      mangle: {
        safari10: true,
        keep_fnames: false // Don't keep function names to save space
      },
      format: {
        comments: false,
        ascii_only: true // Ensure ASCII output
      }
    },
    target: 'es2022', // Use more modern JavaScript for smaller bundles
    // CSS code splitting
    cssCodeSplit: true,
    // Asset inlining threshold (inline small assets)
    assetsInlineLimit: 4096
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom', 
      'react-is',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@reduxjs/toolkit',
      'react-redux'
    ],
    // Exclude heavy libraries that are lazy-loaded
    exclude: ['xlsx', 'jspdf', 'html2canvas', 'tesseract.js'],
    esbuildOptions: {
      // Force CommonJS modules to be treated as ES modules
      mainFields: ['module', 'main'],
      // Ensure proper JSX runtime detection
      jsx: 'automatic',
      jsxImportSource: 'react',
      // Define process.env properly for different environments
      define: {
        'process.env.NODE_ENV': process.env.NODE_ENV === 'production' ? '"production"' : '"development"'
      }
    }
  }
})
