const postcss = require('postcss')
const tailwindcss = require('tailwindcss')
const autoprefixer = require('autoprefixer')

const originalParse = postcss.parse.bind(postcss)

postcss.parse = (css, options) => {
  const normalizedOptions = options ? { ...options } : {}

  if (normalizedOptions.from === undefined) {
    normalizedOptions.from = 'inline.css'
  }

  return originalParse(css, normalizedOptions)
}

module.exports = {
  plugins: [tailwindcss, autoprefixer],
}
