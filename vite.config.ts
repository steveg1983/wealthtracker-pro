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
      const plugins = [react()]
      // Compress only during build, and only if enabled
      if (ENABLE_COMPRESS) {
        plugins.push(
          compression({ algorithm: 'gzip', threshold: 1024, deleteOriginalAssets: false, apply: 'build' }) as any,
          compression({ algorithm: 'brotliCompress', threshold: 1024, deleteOriginalAssets: false, apply: 'build' }) as any,
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
      'es-toolkit/compat/get': 'lodash-es/get',
      // Fix for Sentry expecting React to be available
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom')
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
    commonjsOptions: {
      transformMixedEsModules: true,
      strictRequires: 'auto'
    },
    rollupOptions: {
      output: {
        // Use default Vite chunking to avoid circular dependencies
        manualChunks: undefined,
        // Use content hash for better caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop()?.split('.')[0] : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        },
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Add format configuration to handle module.exports
        format: 'es',
        interop: 'esModule'
      }
    },
    // Re-enable tree-shaking with safe settings
    treeshake: {
      moduleSideEffects: true,
      propertyReadSideEffects: false
    },
    // Enable minification but preserve React
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
        keep_fnames: false, // Don't keep function names to save space
        // CRITICAL: Preserve React internals
        reserved: ['React', 'ReactDOM', 'ReactDOMClient', '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED']
      },
      format: {
        comments: false,
        ascii_only: true // Ensure ASCII output
      }
    },
    target: 'es2022', // Use more modern JavaScript for smaller bundles
    // Report compressed size
    reportCompressedSize: true,
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
      // Ensure React is available globally for libraries that expect it
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    }
  }
})
