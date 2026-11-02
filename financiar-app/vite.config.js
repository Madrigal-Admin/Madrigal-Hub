import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Antetul comun al Hub-ului stă în folderul ../shared (la rădăcina proiectului), folosit de toate aplicațiile.
// Aliasurile pentru react fac ca și fișierele din ../shared să folosească React-ul acestei aplicații.
const aici = (cale) => fileURLToPath(new URL(cale, import.meta.url))

export default defineConfig({
  base: '/financiar/',
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@shared', replacement: aici('../shared') },
      { find: /^react$/, replacement: aici('./node_modules/react/index.js') },
      { find: /^react\/jsx-runtime$/, replacement: aici('./node_modules/react/jsx-runtime.js') },
    ],
  },
})
