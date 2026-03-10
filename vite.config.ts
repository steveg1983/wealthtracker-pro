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
    open: false,
    proxy: {
      '/api': {
        target: 'https://wealthtracker-web.vercel.app',
        changeOrigin: true,
        secure: true
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
    chunkSizeWarningLimit: 500, // Lowered from 1000 to enforce stricter bundle size limits
    rollupOptions: {
      output: {
        // Let Rollup handle chunking automatically to avoid circular chunk dependencies
        // Manual chunking previously caused TDZ crashes ("Cannot access before initialization")
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
      // Aggressive tree-shaking optimizations
      treeshake: {
        preset: 'recommended',
        moduleSideEffects: 'no-external', // Internal modules (services) have side effects; only externals are safe
        propertyReadSideEffects: false,
        manualPureFunctions: ['console.log', 'console.warn', 'console.debug', 'console.info']
      }
    },
    // Use esbuild (Vite default) - Terser causes TDZ crashes with circular deps
    minify: 'esbuild',
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