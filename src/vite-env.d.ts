/// <reference types="vite/client" />

// SECURITY: never declare server-side secrets here. Any VITE_-prefixed variable
// is inlined into the public browser bundle. The Supabase service-role key and
// Stripe secret key are server-only (SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY)
// and must only be read via process.env in api/ handlers and scripts.
interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string
  readonly VITE_SENTRY_DSN: string
  readonly VITE_APP_URL: string
  readonly MODE: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly SSR: boolean
  readonly BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
