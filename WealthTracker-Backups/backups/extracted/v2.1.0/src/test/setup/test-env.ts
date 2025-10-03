/**
 * Test Environment Variables
 * Sets up environment variables for testing
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Mock Vite environment variables
(globalThis as any).import = {
  meta: {
    env: {
      MODE: 'test',
      DEV: false,
      PROD: false,
      SSR: false,
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_mock_key',
      VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_stripe_key',
      VITE_SENTRY_DSN: '',
      VITE_ENABLE_ERROR_TRACKING: 'false',
      VITE_APP_VERSION: '1.0.0-test',
      VITE_APP_ENV: 'test',
      VITE_APP_NAME: 'WealthTracker Test',
      VITE_APP_URL: 'http://localhost:3000',
    },
  },
};

export {};