import { defineConfig, devices } from '@playwright/test'

// Browser tests against the built site (run `pnpm build` first), served the way Vercel serves it.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4322', ...devices['Pixel 5'] },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 5'] } },
    // The scroll-in motion (D-066) in a second engine, and in Firefox as it was before CSS scroll-driven animations shipped
    { name: 'firefox', grep: /motion/, use: { browserName: 'firefox', viewport: { width: 393, height: 851 }, hasTouch: true } },
    { name: 'firefox-old', grep: /motion/, use: { browserName: 'firefox', viewport: { width: 393, height: 851 }, hasTouch: true, launchOptions: { firefoxUserPrefs: { 'layout.css.scroll-driven-animations.enabled': false } } } },
  ],
  webServer: { command: 'node scripts/serve-out.mjs', env: { PORT: '4322' }, url: 'http://localhost:4322/', reuseExistingServer: false },
})
