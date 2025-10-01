import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression2'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ANALYZE = !!process.env.ANALYZE_BUNDLE
const ENABLE_COMPRESS = process.env.ENABLE_ASSET_COMPRESSION !== 'false'

const manualChunkGroups: Array<{ name: string; test: (id: string) => boolean }> = [
  {
    name: 'vendor-plotly',
    test: id =>
      /node_modules[/]react-plotly\.js/.test(id) ||
      /node_modules[/](plotly\.js|plotly\.js-dist)/.test(id) ||
      /node_modules[/]@plotly[/]/.test(id)
  },
  {
    name: 'vendor-charting',
    test: id => /node_modules[/](chart\.js|react-chartjs-2|recharts)/.test(id)
  },
  {
    name: 'vendor-export',
    test: id =>
      /node_modules[/]xlsx/.test(id) ||
      /node_modules[/]jspdf/.test(id) ||
      /node_modules[/]jspdf-autotable/.test(id) ||
      /node_modules[/]html2canvas/.test(id) ||
      /node_modules[/]canvg/.test(id) ||
      /node_modules[/]pako/.test(id) ||
      /node_modules[/]fflate/.test(id) ||
      /node_modules[/]fast-png/.test(id) ||
      /node_modules[/]iobuffer/.test(id) ||
      /node_modules[/]svg-pathdata/.test(id)
  },
  {
    name: 'vendor-grid',
    test: id => /node_modules[/]ag-grid-/.test(id)
  },
  {
    name: 'vendor-realtime',
    test: id => /node_modules[/]socket\.io/.test(id) || /node_modules[/]@supabase[/]realtime-js/.test(id)
  },
  {
    name: 'vendor-analytics',
    test: id => /node_modules[/](ml-matrix|simple-statistics|regression)/.test(id)
  },
  {
    name: 'vendor-react-grid-layout',
    test: id => /node_modules[/]react-grid-layout/.test(id) || /node_modules[/]react-resizable/.test(id)
  },
  {
    name: 'vendor-react-router',
    test: id => /node_modules[/](react-router|react-router-dom)/.test(id)
  },
  {
    name: 'vendor-virtualization',
    test: id =>
      /node_modules[/]react-window/.test(id) ||
      /node_modules[/]react-window-infinite-loader/.test(id) ||
      /node_modules[/]react-virtualized/.test(id) ||
      /node_modules[/]react-virtualized-auto-sizer/.test(id) ||
      /node_modules[/]@tanstack[/]react-virtual/.test(id)
  },
  {
    name: 'vendor-dnd',
    test: id => /node_modules[/]@dnd-kit[/]/.test(id)
  },
  {
    name: 'vendor-icons',
    test: id =>
      /node_modules[/]@tabler[/]icons-react/.test(id) ||
      /node_modules[/]@heroicons[/]react/.test(id) ||
      /node_modules[/]lucide-react/.test(id) ||
      /node_modules[/]react-circular-progressbar/.test(id)
  },
  {
    name: 'vendor-floating-ui',
    test: id => /node_modules[/]@floating-ui[/]/.test(id)
  },
  {
    name: 'vendor-sentry',
    test: id => /node_modules[/]@sentry[/]/.test(id)
  },
  {
    name: 'vendor-auth',
    test: id => /node_modules[/]@clerk[/]/.test(id)
  },
  {
    name: 'vendor-motion',
    test: id => /node_modules[/]framer-motion/.test(id)
  },
  {
    name: 'vendor-react-core',
    test: id =>
      /node_modules[/]react(?:[/]|$)/.test(id) ||
      /node_modules[/]react-dom/.test(id) ||
      /node_modules[/]scheduler/.test(id)
  },
  {
    name: 'vendor-date-fns',
    test: id => /node_modules[/]date-fns/.test(id)
  }
]

const createCompressionPlugin = (algorithm: 'gzip' | 'brotliCompress'): PluginOption =>
  compression({
    algorithms: [algorithm],
    threshold: 1024,
    deleteOriginalAssets: false
  })

export default defineConfig(({ command }) => {
  const isBuild = command === 'build'

  const plugins: PluginOption[] = [
    react({
      jsxRuntime: 'classic'
    })
  ]

  if (isBuild && ENABLE_COMPRESS) {
    plugins.push(createCompressionPlugin('gzip'))
    plugins.push(createCompressionPlugin('brotliCompress'))
  }

  if (ANALYZE) {
    plugins.push(
      visualizer({
        open: true,
        filename: 'bundle-stats.html',
        gzipSize: true,
        brotliSize: true
      })
    )
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'es-toolkit/compat/get': 'lodash-es/get',
        react: path.resolve(__dirname, 'node_modules/react'),
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
          secure: false
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
          manualChunks: id => {
            if (!id.includes('node_modules')) {
              return undefined
            }

            const matchedGroup = manualChunkGroups.find(group => group.test(id))
            if (matchedGroup) {
              return matchedGroup.name
            }

            if (/node_modules[/]decimal\.js/.test(id) || /node_modules[/]date-fns/.test(id)) {
              return 'vendor-core'
            }

            if (/node_modules[/]@reduxjs[/]toolkit/.test(id) || /node_modules[/]react-redux/.test(id)) {
              return 'vendor-state'
            }

            if (/node_modules[/]@supabase/.test(id)) {
              return 'vendor-supabase'
            }

            if (/node_modules[/]@stripe/.test(id) || /node_modules[/]stripe/.test(id)) {
              return 'vendor-stripe'
            }

            return 'vendor-shared'
          },
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: chunkInfo => {
            // eslint-disable-next-line no-control-regex
            const manualName = chunkInfo.name?.replace(/\u0000/g, '')?.replace(/\s+/g, '-')
            const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop()?.split('.')[0] : undefined
            const chunkBaseName = manualName && manualName !== 'chunk' ? manualName : facadeModuleId ?? 'chunk'
            return `assets/${chunkBaseName}-[hash].js`
          },
          assetFileNames: 'assets/[name]-[hash].[ext]',
          format: 'es',
          interop: 'esModule'
        },
        treeshake: {
          moduleSideEffects: true,
          propertyReadSideEffects: false
        }
      },
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false,
          drop_debugger: true,
          pure_funcs: ['console.debug', 'console.info', 'console.log'],
          passes: 2,
          inline: 2,
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
          keep_fnames: false,
          reserved: ['React', 'ReactDOM', 'ReactDOMClient', '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED']
        },
        format: {
          comments: false,
          ascii_only: true
        }
      },
      target: 'es2022',
      reportCompressedSize: true,
      cssCodeSplit: true,
      assetsInlineLimit: 4096
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'react-is', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@reduxjs/toolkit', 'react-redux'],
      exclude: ['xlsx', 'jspdf', 'html2canvas', 'tesseract.js'],
      esbuildOptions: {
        mainFields: ['module', 'main'],
        define: {
          'process.env.NODE_ENV': '"production"'
        }
      }
    }
  }
})
