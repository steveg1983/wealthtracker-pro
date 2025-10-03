# WealthTracker Web App

Production‑grade personal finance tracker built with React, TypeScript, and Vite. Integrates Clerk (auth), Supabase (data + realtime), Stripe (subscriptions), and ships as a PWA with offline support and an update flow.

**Stack**
- React 18, TypeScript, Redux Toolkit
- Vite 7, Vitest, Playwright (optional)
- Supabase (`@supabase/supabase-js`), Clerk, Stripe
- Sentry (optional), TailwindCSS

## Setup

1) Install dependencies
- Use Node 18+ and npm
- Run: `npm install`

2) Environment variables
- Copy `.env.example` to `.env.local` and fill values.
- For production, use `.env.production.example` as a guide and set real values in your hosting provider (do not commit secrets).

Required (minimum):
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY` (for subscription UI)

Related docs:
- `SUPABASE_SETUP.md:1`
- `STRIPE_WEBHOOK_SETUP.md:1`
- `PWA_IMPLEMENTATION.md:1`
- `ENABLE_REALTIME_SUPABASE.md:1`

## Run

- Dev: `npm run dev` → app at http://localhost:5173
- Lint: `npm run lint`
- Unit tests: `npm run test` (UI: `npm run test:ui`)
- E2E (Playwright): `npm run test:e2e`

## Build & Preview

- Build: `npm run build`
- Preview: `npm run preview` (serves built assets)

## Deploy

- Vercel: deploy the repo; configure env vars in Vercel. The app routes are SPA‑rewritten by `vercel.json:1`. The Stripe webhook lives at `api/stripe-webhook.ts:1`.

## Security & Privacy

- CSP is applied in dev via middleware and can be applied in prod via server middleware. See `src/security/csp.ts:1`.
- Production CSP avoids `'unsafe-eval'`; development relaxes as needed for DX.
- Centralized logging: `src/services/loggingService.ts:1` (suppressed in production except warnings/errors).
- Never commit secrets. `.env.*` files are ignored; use `.env.production.example` as reference only.

## PWA & Updates

- Service worker registration is in `src/utils/serviceWorkerRegistration.ts:1`.
- Update banner is shown by `src/components/ServiceWorkerUpdateNotification.tsx:1` (wired in `src/components/Layout.tsx:848`). Choosing “Update Now” activates the new SW and reloads.

## Realtime

- Supabase Realtime subscriptions are exposed in `src/services/supabaseService.ts:293`. Ensure you clean up subscriptions when components unmount.

## Notable Scripts

- `build:production`: build with compression
- `perf:test`: build + bundle check + Lighthouse
- `test:coverage`: vitest coverage
- `bundle:report`: visualizer report to `bundle-stats.html`
- `clean:artifacts`: remove `dist/`, `coverage/`, and `playwright-report/`

## Contributing

- Keep types strict. Prefer DTOs and validation at module boundaries.
- Use the logger instead of raw `console.*` in production paths.
