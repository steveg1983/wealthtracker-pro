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
    },
  },
  plugins: [],
}
