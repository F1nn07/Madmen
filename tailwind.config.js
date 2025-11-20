/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/templates/**/*.html",
    "./app/static/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        'mad-gold': '#B07D4A',
        'mad-pink': '#C724B1',
        'mad-dark': '#0a0a0a',
        'mad-card': '#1a1a1a',
      }
    },
  },
  plugins: [],
}