/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
        },
      },
    },
  },
  plugins: [],
}
