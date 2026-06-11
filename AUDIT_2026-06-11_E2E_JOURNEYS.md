# End-to-End Journey Suite — 2026-06-11

The eighth and final audit: real-browser tests of the money journeys, so
regressions in the flows that matter (loading a page, recording money,
searching, exporting) fail a test instead of reaching a user.

**Run**: `npm run test:e2e:journeys` (Playwright, Chromium). Journeys run
against the Vite dev server in demo mode (`?demo=true` — Clerk bypassed,
sample data seeded), so no live backend or test accounts are needed.

## Starting state

There was no working E2E setup: `playwright.config.ts` existed only in
backups, so `npm run test:e2e` would have failed. One spec
(`e2e/banking-ops-badges.spec.ts`) needs the Vercel API and is not part of
this suite.

## The suite — 11 journeys, all passing

| Spec | Covers |
|---|---|
| `navigation.journey` (×8) | Every primary page (dashboard, transactions, accounts, budget, calendar, reports, goals) loads, renders its own content, and throws no uncaught errors; sidebar links route correctly |
| `add-transaction.journey` | The core money journey: open the add-transaction modal from the dashboard, fill account + description + amount + category drill-down, save, and confirm the transaction appears in the list |
| `search-and-export.journey` (×2) | Global search returns a results panel; GDPR "export everything" downloads a complete JSON bundle with all entity keys |

## Real bugs the suite caught and fixed

Building these journeys surfaced **three genuine defects** — exactly the point
of E2E coverage:

1. **`/goals` crashed the whole page** — `goal.type.replace()` threw
   `Cannot read properties of undefined` when a goal had no `type`, and the
   error boundary replaced the entire app shell. This is a real robustness
   bug (any goal missing a type — legacy data, import edge cases — would
   crash the page, not just demo). Fixed with a guard
   (`(goal.type ?? "savings").replace(...)`).

2. **Demo mode loaded transactions but not accounts** — `loadAppData()` reads
   accounts from storage, but the context only ever set accounts from the
   user-id-dependent `SimpleAccountService` path, which is empty without a
   Clerk user. So in demo mode the accounts page was blank, the dashboard
   distribution was empty, and the add-transaction modal had no selectable
   account. Fixed: fall back to the storage-backed accounts in demo/local
   mode. This also matters for the CLAUDE.md "ChatGPT tests via demo mode"
   QA workflow — demo mode is now actually usable.

3. **Demo categories were structurally incomplete** — flat `{id,name,type}`
   objects with no `level`/`parentId`, so the transaction modal's
   type→sub→detail category selector was empty and a transaction could not be
   recorded in demo mode. Rebuilt the demo category set as a proper hierarchy
   (type parents, sub-categories, detail leaves) matching the real schema.

(These are in addition to the earlier performance-audit finding that demo
mode seeded the wrong storage keys and used string money values — demo mode
has now been repaired end to end across this session.)

## Design notes

- **Demo mode, not a deployment**: production builds deliberately disable the
  `?demo=true` bypass (a security control), so journeys run against the dev
  server where the bypass is allowed. They exercise real rendering and
  interaction; they do not test the deployed API (that is the pentest's
  manual checklist).
- **Consent/onboarding suppressed via init script**: the cookie-consent
  banner and onboarding modal are fixed/overlay elements that intercept
  clicks. `gotoDemo` pre-sets the consent + onboarding flags in localStorage
  before load (exactly as a returning user who already chose), so they never
  render — rather than racing to dismiss them post-load.
- **`networkidle` is unusable here**: demo mode fetches merchant logos
  continuously, so the network never idles; `waitForApp()` (sidebar nav
  visible) is the real ready signal.
- Workers capped at 2 (one shared dev server); `test-results/` and
  `playwright-report/` are gitignored.

## Coverage honesty — what these journeys do NOT cover

- **Cross-page state mutations against the real backend** (the add-transaction
  test verifies the optimistic UI + storage path in demo mode, not a Supabase
  round-trip). Backend write paths are covered by the unit/integration suites
  and the Supabase smoke tests.
- **Auth, billing checkout, and bank-linking journeys** — these need real
  Clerk sessions / Stripe / TrueLayer and belong in a staging E2E run against
  the deployed app, after the rollout.
- **Mobile viewports / cross-browser** — the suite is desktop-Chromium only
  (this is a desktop-first app); add projects for mobile/WebKit when the
  companion app work starts.

## Maintenance
New interactive features should get a journey here. Keep selectors stable
(prefer roles, labels, and the form element ids used in
`add-transaction.journey`). Run `npm run test:e2e:journeys` before UI-heavy
merges.
