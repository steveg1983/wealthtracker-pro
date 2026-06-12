# Performance / Core Web Vitals Audit — 2026-06-11

**Tools**: Lighthouse 12 (desktop preset) against a minified local build;
`scripts/audit-performance-stress.mjs` (10,000-transaction stress harness,
real Chromium, PerformanceObserver long-task collection). Reports in
`logs/performance/`.

**Measurement honesty note**: production builds deliberately hard-disable the
`?demo=true` auth bypass, so app pages were measured on a `--mode test` build
(same minification; near-production). Local serving means no real network
latency — treat absolute LCP/FCP as best-case; TBT/CLS/long-task numbers are
valid. First-run Lighthouse numbers in this session accidentally measured the
landing page for protected routes (the redirect); the corrected app-page runs
are below.

## Scores (desktop, minified build, demo data)

| Page | Score | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|
| /dashboard | 91 | 0.8 s | 1.7 s | 0 ms | 0 |
| /transactions | 93 | 0.8 s | 1.4 s | 0 ms | 0 |
| Landing page | 90–97 | 0.8–0.9 s | 1.0–1.5 s | 0 ms | 0 |

Zero total blocking time and zero layout shift across the board.

## 10,000-transaction stress test

The P1 pagination fix means the app now loads a user's FULL history into
context state — this test checks what that costs at realistic long-term scale:

| Metric | Result |
|---|---|
| /transactions initial load+render | 2.5 s |
| Transaction rows in DOM | **20** (paginated/virtualised — not 10k) |
| Total DOM nodes | ~2,000 |
| Long tasks at boot | 0 |
| Main-thread blocking while typing in search | 0 ms |
| /dashboard load (Decimal sums over all 10k) | ~3.0 s wall, 0 long tasks |

Verdict: the monolithic-context re-render concern from the backend audit does
NOT manifest as user-visible jank at 10k transactions. List rendering is
properly windowed; search filtering doesn't block the main thread.

## Fixes shipped from this audit

1. **Stripe.js no longer loads on every page (−251 KB per page view).**
   Two causes: a module-level `loadStripe()` in subscriptionApiService whose
   promise was *never consumed* (deleted), and the subtler one — the default
   `@stripe/stripe-js` entry point injects the js.stripe.com script as a side
   effect of the import itself. Switched to `@stripe/stripe-js/pure`, which
   defers injection until checkout/billing actually calls it. Dashboard
   script transfer: 931 KB → 680 KB (−27%). Trade-off documented in code:
   Stripe's all-pages fraud telemetry is forgone; signals still collect on
   payment pages.

2. **Demo mode was completely broken — and hiding a money-type bug.**
   `initializeDemoData` seeded localStorage keys (`transactions`, …) that
   nothing has read since the encrypted-IndexedDB storage migration; demo
   visitors saw empty states. Fixed to seed the `wealthtracker_*` keys the
   storage adapter migrates. Making the data flow immediately exposed the
   second bug: demo amounts/balances were formatted STRINGS (`'600.00'`)
   violating `amount: number` — one string turns every `sum + t.amount`
   reduce into string concatenation and crashed pages with
   `[DecimalError] Invalid argument: 01734.63-501.95…`. All demo money
   fields are now numbers.

## Remaining opportunities (documented, not blockers)

- Main chunk is 1,020 KB raw / ~294 KB gz — still above the 200 KB gz
  target. Next candidates per bundle analysis: the 551 KB lazy `index.esm`
  chunk (identify owner), icon tree-shaking, manualChunks vendor splitting.
- ~508 KiB of the main chunk is unused on first dashboard paint (Lighthouse
  unused-javascript) — vendor splitting would let more of it cache/idle-load.
- Real-world numbers (Vercel + network latency) should be confirmed with a
  Lighthouse run against the production deployment once the rollout
  completes; local numbers exclude CDN/TLS/edge latency.
