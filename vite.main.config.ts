import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Packages that must NOT be bundled — they exist at runtime in the Electron process
const EXTERNAL = [
  'electron',
  'electron-store',
  '@anthropic-ai/sdk',
  '@modelcontextprotocol/sdk',
  /^node:.*/,
  'path', 'fs', 'https', 'http', 'os', 'crypto', 'stream', 'events',
  'util', 'buffer', 'url', 'querystring', 'assert', 'net', 'tls',
]

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
    conditions: ['node'],
  },
  build: {
    rollupOptions: {
      external: EXTERNAL,
    },
  },
})
