/**
 * Test Environment Variables
 * Uses REAL Supabase for testing - no mocks!
 * Following principle: "If it's not tested against real infrastructure, it's not tested"
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Use runtime-provided env (CI/local). Do NOT hardcode secrets here.
(globalThis as any).import = {
  meta: {
    env: {
      MODE: 'test',
      DEV: false,
      PROD: false,
      SSR: false,
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? 'test-anon-key',
      VITE_CLERK_PUBLISHABLE_KEY: process.env.VITE_CLERK_PUBLISHABLE_KEY ?? 'pk_test_dummy',
      VITE_STRIPE_PUBLISHABLE_KEY: process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? 'pk_test_dummy',
      VITE_SENTRY_DSN: process.env.VITE_SENTRY_DSN ?? '',
      VITE_ENABLE_ERROR_TRACKING: 'false',
      VITE_APP_VERSION: '1.0.0-test',
      VITE_APP_ENV: 'test',
      VITE_APP_NAME: 'WealthTracker Test',
      VITE_APP_URL: 'http://localhost:3000',
    },
  },
};

export {};
