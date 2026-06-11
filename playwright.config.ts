import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the end-to-end journey suite.
 *
 * Journeys run against the Vite dev server in demo mode (?demo=true), which
 * bypasses Clerk auth and seeds sample data — so the money journeys exercise
 * real rendering and interaction without a live backend or test accounts.
 *
 * `npm run test:e2e:journeys` runs e2e/journeys/*. The pre-existing
 * e2e/banking-ops-badges.spec.ts needs the Vercel API and is not part of this
 * suite.
 */
export default defineConfig({
  testDir: './e2e/journeys',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 1,
  // Single Vite dev server backs all journeys; too many parallel workers
  // overwhelm it and cause load-timing flakes. Cap at 2.
  workers: 2,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev:vite',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
