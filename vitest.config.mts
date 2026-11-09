import path from 'node:path'

import { defineConfig } from 'vitest/config'

const alias = { '@': path.resolve('src'), 'server-only': path.resolve('tests/server-only-stub.ts') }

export default defineConfig({
  test: {
    projects: [
      { resolve: { alias }, test: { name: 'unit', include: ['tests/unit/**/*.test.{ts,tsx}'], environment: 'node' } },
      // Runs against the built site in out/ (run `pnpm build` first).
      { resolve: { alias }, test: { name: 'site', include: ['tests/site/**/*.test.ts'], environment: 'node', testTimeout: 600_000 } },
    ],
  },
})
