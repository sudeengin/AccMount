/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Design System - Unified Dark-Layered Colors
        'page-bg': '#151420',
        'card-bg': '#151A22',
        'card-border': '#2A3340',
        'income': '#4ADE80',
        'expense': '#F87171',
        'neutral-text': '#94A3B8',
      },
      fontFamily: {
        'sans': ['Inter', 'DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'control': '12px',
        'card': '16px',
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
      }
    },
  },
  plugins: [],
}
