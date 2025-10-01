import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)

const postcss = require('postcss')
const plugin = require('tailwindcss/plugin')
const tailwindScrollbar = require('tailwind-scrollbar')
const tailwindPackage = require('tailwindcss/package.json')

const preflightPath = require.resolve('tailwindcss/src/css/preflight.css')

const preflightPlugin = plugin(({ addBase }) => {
  const preflightCss = readFileSync(preflightPath, 'utf8')
  const preflightRoot = postcss.parse(preflightCss, { from: preflightPath })

  addBase([
    postcss.comment({
      text: `! tailwindcss v${tailwindPackage.version} | MIT License | https://tailwindcss.com`,
    }),
    ...preflightRoot.nodes,
  ])
})

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary, #0078d4)',
        secondary: 'var(--color-secondary, #005a9e)',
        accent: '#FFF2CC',
        success: '#34c759',
        danger: '#ff3b30',
        warning: '#ff9500',
        // New UI control colors from screenshot
        'ui-bg': '#6B7AB8',
        'ui-control': '#5A6AA8',
        'ui-control-hover': '#4D5C9B',
        'ui-add': '#FF5A5F',
        'ui-add-hover': '#FF4146',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'zoom-in-95': {
          '0%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        'slide-in-from-bottom-4': {
          '0%': { transform: 'translateY(1rem)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'in': 'fade-in 0.2s ease-out, zoom-in-95 0.2s ease-out, slide-in-from-bottom-4 0.2s ease-out',
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [
    preflightPlugin,
    tailwindScrollbar({ nocompatible: true }),
  ],
}
