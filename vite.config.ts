import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression2'
import path from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// https://vite.dev/config/
export default defineConfig({
  css: {
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer,
      ],
    },
  },
  plugins: [
    react(),
    // Add gzip compression for better mobile performance
    compression({
      algorithms: ['gzip'],
      threshold: 1024, // Compress files larger than 1kb for mobile
      deleteOriginalAssets: false,
    }),
    // Add brotli compression for modern browsers
    compression({
      algorithms: ['brotliCompress'],
      threshold: 1024,
      deleteOriginalAssets: false,
    })
  ],
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
    open: false
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    open: false
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 500, // Lowered from 1000 to enforce stricter bundle size limits
    rollupOptions: {
      output: {
        // Optimized chunking - keep React together to avoid module errors
        manualChunks: (id) => {
          // Custom function to better control chunking
          if (id.includes('node_modules')) {
            // Excel/CSV libraries
            if (id.includes('xlsx') || id.includes('sheetjs')) {
              return 'xlsx';
            }
            // PDF libraries
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('autotable')) {
              return 'pdf';
            }
            // Charts - Recharts and D3 (excluding Plotly)
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory') || id.includes('chart')) {
              return 'charts';
            }
            // Plotly - separate due to large size
            if (id.includes('plotly')) {
              return 'plotly';
            }
            // Core React ecosystem
            if (id.includes('react') || id.includes('redux') || id.includes('react-dom')) {
              return 'vendor';
            }
            // Authentication libraries
            if (id.includes('@supabase') || id.includes('@clerk')) {
              return 'auth';
            }
            // Date utilities
            if (id.includes('date-fns') || id.includes('dayjs') || id.includes('moment')) {
              return 'date-utils';
            }
            // All other node_modules
            return 'vendor-misc';
          }
        },
        // Use content hash for better caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop()?.split('.')[0] : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        },
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
      // Aggressive tree-shaking optimizations
      treeshake: {
        preset: 'recommended',
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        manualPureFunctions: ['console.log', 'console.warn', 'console.debug', 'console.info']
      }
    },
    // Use terser for better minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for accessibility
        drop_debugger: true,
        pure_funcs: ['console.debug'],
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
    // Report compressed size
    reportCompressedSize: true,
    // CSS code splitting
    cssCodeSplit: true,
    // Asset inlining threshold (inline small assets)
    assetsInlineLimit: 4096
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'react-is'],
    // Exclude heavy libraries that are lazy-loaded
    exclude: ['xlsx', 'jspdf', 'html2canvas', 'tesseract.js'],
    esbuildOptions: {
      // Force CommonJS modules to be treated as ES modules
      mainFields: ['module', 'main']
    }
  }
})