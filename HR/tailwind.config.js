/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}', '../shared/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1c2230',
        slate: {
          925: '#0f1420',
        },
        brand: {
          50: '#eef3fb',
          100: '#e4ecf8',
          200: '#c9d8ee',
          300: '#9db5d8',
          400: '#6a8dbf',
          500: '#3f6399',
          600: '#22406b',
          700: '#1a3355',
          800: '#142846',
          900: '#0e1c33',
        },
        clay: {
          500: '#c96f4a',
          600: '#b25a37',
        },
      },
      fontFamily: {
        display: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
