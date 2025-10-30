import { loadViteTestEnv } from '@wealthtracker/testing/load-vite-test-env';

loadViteTestEnv({
  defaultValues: {
    VITE_TEST_ENV: 'true',
    VITE_APP_ENV: 'test',
    VITE_APP_NAME: 'WealthTracker Test',
    VITE_APP_URL: 'http://localhost:3000',
    VITE_APP_VERSION: '1.0.0-test',
    VITE_ENABLE_ERROR_TRACKING: 'false',
    VITE_SENTRY_DSN: '',
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_ANON_KEY: '',
    VITE_CLERK_PUBLISHABLE_KEY: '',
    VITE_STRIPE_PUBLISHABLE_KEY: '',
    VITEST_SUPABASE_EMAIL: '',
    VITEST_SUPABASE_PASSWORD: '',
  },
  supabase: {
    modeKey: 'VITEST_SUPABASE_MODE',
    defaultMode: 'mock',
    requiredWhenReal: [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITEST_SUPABASE_EMAIL',
      'VITEST_SUPABASE_PASSWORD',
    ],
  },
});

export {};
