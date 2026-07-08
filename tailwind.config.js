/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Wealth/finance brand palette
        primary: 'var(--color-primary, #1a2332)',
        secondary: 'var(--color-secondary, #2d3a4d)',
        accent: '#d4a843',

        // Surface colors
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f8f9fb',
          tertiary: '#f1f3f7',
        },

        // WCAG AA compliant card backgrounds
        'card-bg': {
          light: '#f1f3f7',
          DEFAULT: '#ffffff',
          dark: '#1f2937',
        },

        // Accessible text colors
        'card-text': {
          light: '#64748b',
          DEFAULT: '#1a2332',
        },

        // Financial semantic colors
        income: '#0d9f6f',
        expense: '#d94052',
        success: '#0d9f6f',
        danger: '#d94052',
        warning: '#e5a00d',

        // Navigation
        nav: {
          bg: '#1a2332',
          text: '#94a3b8',
          active: '#ffffff',
          hover: '#2d3a4d',
        },

        // UI control colors (navy scheme; ui-add stays green as a semantic
        // "add/positive" accent)
        'ui-bg': '#2d3a4d',
        'ui-control': '#1a2332',
        'ui-control-hover': '#2d3a4d',
        'ui-add': '#0d9f6f',
        'ui-add-hover': '#0b8a5f',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
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
  plugins: [],
}
