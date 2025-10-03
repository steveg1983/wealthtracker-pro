/**
 * Test Environment Variables
 * Uses REAL Supabase for testing - no mocks!
 * Following principle: "If it's not tested against real infrastructure, it's not tested"
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Use REAL Supabase and services for testing
(globalThis as any).import = {
  meta: {
    env: {
      MODE: 'test',
      DEV: false,
      PROD: false,
      SSR: false,
      // REAL Supabase instance (your existing one)
      VITE_SUPABASE_URL: 'https://nqbacrjjgdjabygqtcah.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xYmFjcmpqZ2RqYWJ5Z3F0Y2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDgxNjgsImV4cCI6MjA2NzkyNDE2OH0.teKfoCvodwO719cNddtlC7k-gWoHu_Ntd64mo6XkDq4',
      // REAL Clerk instance
      VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_ZGVzdGluZWQtY29icmEtNTkuY2xlcmsuYWNjb3VudHMuZGV2JA',
      VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_51RwrTV274HWpxM1qTPFb8Fi9qQ7BGuNftCI1psDTPYY7j4bNvK3KtkmkRBJHheThMOsI175fkWuB3IUYu1Ay22nz00zBjjOMHO',
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