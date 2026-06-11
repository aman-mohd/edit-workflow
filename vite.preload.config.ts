import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
    conditions: ['node'],
  },
  build: {
    rollupOptions: {
      external: ['electron', /^node:.*/],
    },
  },
})
