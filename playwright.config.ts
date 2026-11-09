import { defineConfig, devices } from '@playwright/test'

// Browser tests against the built site (run `pnpm build` first), served the way Vercel serves it.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4322', ...devices['Pixel 5'] },
  webServer: { command: 'node scripts/serve-out.mjs', env: { PORT: '4322' }, url: 'http://localhost:4322/', reuseExistingServer: false },
})
