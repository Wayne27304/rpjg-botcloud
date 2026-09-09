/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          dark: '#1e1f22',
          darker: '#141517',
          darkest: '#0e0f11',
          sidebar: '#2b2d31',
          card: '#232428',
          input: '#1e1f22',
          blurple: '#5865F2',
          'blurple-hover': '#4752C4',
          green: '#23a55a',
          yellow: '#f0b232',
          red: '#f23f43',
          purple: '#9b59b6',
          cyan: '#00b0f4'
        },
        rpjg: {
          accent: '#6366f1',
          cyan: '#06b6d4',
          neon: '#10b981'
        }
      },
      fontFamily: {
        mono: ['"Fira Code"', 'Consolas', 'Monaco', 'Courier New', 'monospace']
      }
    },
  },
  plugins: [],
}
