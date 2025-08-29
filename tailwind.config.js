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
  plugins: [
    require('tailwind-scrollbar')({ nocompatible: true }),
  ],
}
