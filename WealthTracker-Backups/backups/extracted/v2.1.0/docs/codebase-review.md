# WealthTracker Web — Codebase Review

Date: 2025-08-30

Scope: Full codebase review excluding tests. Focus on architecture, data model, frontend/backend integration, security, PWA, and tooling.

## High‑Priority Gaps

### 1) Backend model mismatch: `users` vs `user_profiles`
- Evidence: Services and TS types primarily use `public.users` with `clerk_id` (e.g., `src/services/api/userService.ts`, `src/types/supabase.ts`), while SQL files (`supabase/schema.sql`, `supabase/subscription-migration.sql`) and some webhook code reference `user_profiles`.
- Impact: Data splits or fails under RLS; realtime filters using `user_id` may not match; foreign keys may reference the wrong table.
- Recommendation: Standardize on `public.users (id UUID, clerk_id TEXT)`.
  - Write a single consolidation migration to merge/rename `user_profiles` → `users`, fix all FKs (`accounts`, `transactions`, `categories`, subscription tables), and update RLS.
  - Regenerate `src/types/supabase.ts` from Supabase; remove stale schema files to avoid drift.

### 2) Service Worker duplication and misregistration
- Evidence: Advanced Workbox SW in `src/pwa/service-worker.ts` compiled to `public/service-worker.js` but app registers `sw.js` in `src/utils/serviceWorkerRegistration.ts`. `main.tsx` actively unregisters non-`sw.js` workers. `public/service-worker.js.disabled` also exists.
- Impact: The intended Workbox SW never runs; the active SW caches `/api/*` endpoints the app does not use (Supabase is used instead). TS SW’s GET route uses `url.search.includes('GET')` (incorrect predicate).
- Recommendation: Pick ONE SW path.
  - If using Workbox: Register `service-worker.js`, remove `public/sw.js`, fix GET route predicates, and scope runtime caching to same-origin assets only.
  - If keeping simple SW: Delete TS Workbox SW and builder; keep `sw.js` only.

### 3) Module system conflicts in server code
- Evidence: Project is ESM (`"type": "module"`) but `server/security-headers.js` and `server/production-server.js` are CommonJS. Multiple server variants exist (Node http, Express `.mjs`, CJS in `server/`).
- Impact: Servers may not run as configured; duplicated implementations confuse the deploy story.
- Recommendation: Keep a single production server (or none if deploying static). Convert to ESM or rename to `.cjs`, integrate with `package.json` scripts, and remove extras.

### 4) Inconsistent ID usage in realtime and services
- Evidence: Good centralization via `userIdService`, but some flows still pass Clerk IDs and let callees decide (e.g., subscriptions in `AppContextSupabase.tsx`).
- Impact: Easy regressions where realtime filters or queries use Clerk IDs instead of DB UUIDs.
- Recommendation: Enforce DB UUIDs at boundaries. Do Clerk→DB conversion once during app init, persist via `userIdService.setCurrentUser`, and type methods so passing Clerk IDs is a compile-time error.

### 5) Redux domain/DTO mismatch
- Evidence: Domain types use `Date` (e.g., `Transaction.date: Date`) while slices persist ISO strings or sometimes raw `Date`. Thunks also store raw Dates for offline fallbacks.
- Impact: Inconsistent serialization leads to subtle UI and calculation issues.
- Recommendation: Adopt DTO mapping: Redux stores JSON-friendly DTOs (strings/numbers), and map to domain types at component/service boundaries. Add centralized converters.

### 6) Security configuration fragmented and permissive
- Evidence: `public/_headers` CSP has `'unsafe-inline'`/`'unsafe-eval'`; `server/security-headers.js` generates nonces but is unused; docs mention a Vite CSP plugin but none is configured in `vite.config.ts`.
- Impact: Production CSP may be weak or inconsistent across hosts.
- Recommendation: Pick the primary hosting target (Vercel/Netlify/Node) and enforce CSP/security headers there only. Remove unsafe directives where feasible; prefer nonces or external scripts. Avoid adding CSP `<meta>` in production when headers exist.

### 7) Schema and product feature drift
- Evidence: `supabase/migrations/009_create_categories_table.sql` introduces `is_transfer_category`/`account_id` (for transfer categories) while `supabase/schema.sql` is older and uses `user_profiles`. Subscription SQL files reference `user_profiles` while services and types mostly target `users`.
- Impact: Applying different files can silently diverge the database. Types may not match runtime schema.
- Recommendation: Keep one authoritative migration chain; remove or archive stale schema.sql. Regenerate types after consolidation.

### 8) Build/tooling complexity vs value
- Evidence: Very aggressive `manualChunks` in `vite.config.ts`, two compression passes, analyzer always enabled, multiple alternative configs.
- Impact: Longer builds, more maintenance, limited benefit.
- Recommendation: Reduce `manualChunks` to a small, justified set (vendor, charts, auth, supabase). Gate analyzer/compression behind env flags. Keep one Vite config.

### 9) Dead/duplicated code paths
- Evidence: Multiple production servers, multiple SWs, numerous diagnostic scripts not tied to the main flow.
- Impact: Onboarding friction and deployment risk.
- Recommendation: Prune unused servers/scripts or move them to `docs/legacy/` with a clear note.

## Other Notable Issues

- SW caches `/api/*` even though the app uses Supabase directly; remove or guard that branch.
- Push notifications: Placeholder VAPID key and unused import of `serviceWorkerRegistration`; gate with a feature flag until a real push backend exists.
- Error handling: Sentry init is present, but errors are logged ad hoc; wrap services and thunks with shared error utilities and add contextual metadata (user IDs, entity IDs).
- Accessibility/performance: Solid components exist; ensure consistent usage on heavy pages and lazy-load heavy libs (Plotly, tfjs, xlsx). Manual chunking can be simplified after measurement.

## Prioritized Action Plan

1) Data model consolidation (critical)
- Standardize on `public.users` with `clerk_id`. Write one consolidation migration to merge `user_profiles`, update all FKs and RLS, and regenerate TS types. Remove obsolete SQL.

2) Service Worker unification (critical)
- Pick Workbox or simple SW, fix registration to the chosen file, remove others. In Workbox SW, fix GET predicates and scope caching to same-origin app assets.

3) Security hardening (high)
- Single deployment target with a single CSP. Remove `'unsafe-eval'` and minimize `'unsafe-inline'` via nonces or bundled scripts. Align `src/security/csp.ts` with deployed headers; don’t double-apply CSP.

4) Realtime and ID discipline (high)
- Make DB UUID the only accepted input for realtime/services; centralize Clerk→DB conversion during initialization, enforce via types.

5) Redux DTO normalization (high)
- Introduce DTO↔domain mappers for dates/decimals. Store ISO strings/numbers in Redux; convert at the edges. Clean reducers and thunks to use a single representation.

6) Tooling simplification (medium)
- Collapse to one `vite.config.ts`. Reduce `manualChunks`. Gate analyzer/compression with env flags.

7) Clean servers/scripts (medium)
- Keep one production server (if needed) or none for static hosting. Remove or archive unused scripts.

8) Offline strategy clarity (medium)
- If true offline is desired, design around Supabase with idb caching and queued mutations. Otherwise, remove misleading `/api` SW paths.

9) Documentation alignment (ongoing)
- Update docs to reflect the consolidated schema, SW approach, and deployment target.

## Concrete File‑Level Callouts

- `supabase/schema.sql`: Stale; references `user_profiles`. Remove or rewrite to match the migrations baseline and the chosen `users` model.
- `supabase/subscription-migration.sql`: Update all `user_profiles` references to `users`; ensure RLS and FKs are correct.
- `src/lib/stripe-webhooks.ts`: Uses `user_profiles`; align with `users` and ensure referenced tables (e.g., `payments`, `subscription_events`) exist or update code to existing tables.
- `src/services/api/simpleAccountService.ts`: Good use of `userIdService` and transfer categories; confirm `categories` table columns exist in production and types cover `is_transfer_category` and `account_id`.
- `src/pwa/service-worker.ts`: Fix GET route predicate, remove `/api` handling if unused, and point registration to this file if Workbox is the choice.
- `src/utils/serviceWorkerRegistration.ts`: Registers `sw.js`; update if moving to Workbox output file.
- `server/security-headers.js`, `server/production-server.js`: CJS in an ESM project; unify or remove.
- `vite.config.ts`: Reduce manual chunking and turn off analyzer by default.
- `src/config/database.ts`: Avoid `require` in TS/ESM; use ESM imports or dynamic import.

## Practical Sequence (What to do first)

1) Unify DB model on `users` and fix FKs/RLS → regenerate Supabase TS types → update services.
2) Pick and wire a single SW → remove the other SW files → verify on deploy.
3) Simplify Vite and server story → remove dead scripts.
4) Normalize Redux DTOs and add mapping utilities.
5) Harden CSP/security on the chosen host.

---
If you want, I can implement (1) schema consolidation and (2) SW unification next, since they unblock many downstream issues and improve reliability immediately.

