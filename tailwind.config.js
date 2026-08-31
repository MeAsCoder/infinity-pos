// tailwind.config.js  (new file, project root — same level as vite.config.js)
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        brand: { DEFAULT: '#7a1230', dark: '#4d0a1e', light: '#9c1d40', 50: '#fdf2f5' },
        gold: { 400: '#e8c874', 500: '#c9a227', 600: '#a9841c' },
        ink: { 950: '#0d0b0d', 900: '#161318', 800: '#211d24', 700: '#2f2a33', 600: '#453e49' },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(20,10,15,0.04), 0 4px 16px rgba(20,10,15,0.06)',
        card: '0 1px 3px rgba(20,10,15,0.06), 0 8px 24px rgba(20,10,15,0.08)',
        popover: '0 12px 40px rgba(10,5,8,0.25)',
      },
    },
  },
  plugins: [],
};