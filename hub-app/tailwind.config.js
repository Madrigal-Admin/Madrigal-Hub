/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}', '../shared/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Aceiași tokeni ca la HR — vezi și /assets/tema-shared.css
        accent: {
          DEFAULT: '#22406B',
          hover: '#142846',
        },
        cream: '#F6EEDB',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
