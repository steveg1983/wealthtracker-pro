# Privacy / GDPR Audit — 2026-06-11

UK-based, processing financial personal data, selling subscriptions → UK GDPR
+ PECR (cookies) apply. This is a **code-and-architecture** audit; it is not
legal advice. Items marked 🔴 are compliance gaps a DPO/lawyer should treat as
blocking before taking real customers; 🟠 are improvements; ✅ are already in
good shape.

Verdict: the data-handling *mechanics* are mostly sound (encryption at rest,
RLS once the rollout lands, clean URL hygiene), but the **data-subject rights
surface is largely missing** — there is no in-app way to delete an account,
no privacy policy, and no cookie consent. These are legal obligations, not
polish.

---

## Data-subject rights (UK GDPR Ch. III)

### 🔴 Right to erasure (Art. 17) — NOT honoured in-app
- "Deleting" a financial account is a **soft delete** (`is_active = false`,
  src/services/api/accountService.ts:248) — the rows persist. The Deleted
  Accounts page says outright: *"If you need to permanently remove an account
  and all its data, please contact support"* (DeletedAccounts.tsx:220).
- There is **no user-account deletion at all** — no "delete my account / close
  account" flow, no endpoint that removes a user's `users` row + Clerk
  identity + all financial data. A manual "email support" process can satisfy
  Art. 17 if it actually executes, but it must be documented and time-bound
  (1 month) — and right now nothing in the codebase performs the deletion.
- **Recommendation**: build an authenticated `DELETE /api/account` that, in
  one transaction, removes the user's rows across all tables (the
  cleanup-test-data script already proves the table/FK order) and deletes the
  Clerk user via the backend SDK. Surface it in Settings → Security behind a
  type-to-confirm dialog. This is the single highest-value privacy gap.

### 🟠 Right to portability (Art. 20) — PARTIAL
- Export Manager produces CSV/Excel/PDF/JSON of **transactions and accounts**
  (ExportManager.tsx) — good, and JSON satisfies "machine-readable". But
  budgets, goals, categories, and documents are **not** in the export.
- **Recommendation**: add a single "Export everything" action that bundles all
  entity types as JSON — both for portability and as the user-facing half of
  a Subject Access Request.

### 🟠 Right of access (Art. 15) — partial, manual
- Users can see their data in-app and export most of it; there's no
  consolidated SAR bundle (would be covered by the portability fix above) and
  no view of the audit-log/processing metadata held about them.

### ✅ Right to rectification (Art. 16)
- Full inline editing of all financial records.

---

## Lawful basis, consent & transparency

### 🔴 No privacy policy / no terms surfaced in the app
- No `/privacy`, `/terms`, PrivacyPolicy component, or footer links anywhere
  in src/. Art. 13/14 require a privacy notice at the point of collection
  (sign-up). **Blocking** for public launch.

### 🔴 No cookie / tracking consent (PECR + GDPR)
- No consent banner (`CookieConsent`/`acceptCookies` absent). The app loads
  **Clerk** (auth — strictly necessary, no consent needed), **Sentry session
  replay** (analytics/diagnostics — **consent required** under PECR), and
  Stripe on billing pages. Sentry Replay records the session; even with text
  masking it is non-essential processing that needs opt-in.
- **Recommendation**: a consent banner that gates Sentry Replay/tracing init
  until accepted; keep strictly-necessary (Clerk, CSRF/session) running
  without consent. `initSentry()` already centralises this — gate the
  `replayIntegration`/`tracesSampleRate` on the stored consent.

---

## Third-party processors & PII flow

### ✅ Sentry PII minimization — FIXED this audit
- **Before**: `setSentryUser` sent `email` + `username` to Sentry; `beforeSend`
  scrubbed only a 4-key flat denylist (password/creditCard/ssn/bankAccount),
  missing nested data, query strings, breadcrumbs, and every financial field
  name.
- **After** (src/lib/sentry.ts): `setSentryUser` sends only the opaque user
  id; new `scrubEventPii` recursively redacts ~20 PII/secret/financial key
  patterns across request data, query strings, cookies, breadcrumbs, and extra
  context. 6 unit tests. Replay already masks all text/inputs/media.
- **Still required (process, not code)**: a Data Processing Agreement with
  each processor (Sentry, Clerk, Stripe, Supabase, Vercel) and disclosure of
  all five in the privacy notice. Confirm each is configured for EU/UK data
  residency.

### ✅ URL hygiene
- No PII in query strings (grep clean); the security rules forbid it and the
  code complies.

### 🟠 PII at rest
- Financial data is encrypted in IndexedDB (encryptedStorageService) — good.
- One plaintext localStorage item holds per-user usage counts keyed by user id
  (`usage_${user.id}`, SubscriptionContext.tsx:183) — low sensitivity but
  inconsistent with the encrypted-everything-else posture; consider moving it
  through storageAdapter.

---

## Retention (Art. 5(1)(e) — storage limitation)

### 🟠 No retention policy on financial data or the audit log
- `financial_audit_log` (migration 20260610150000) grows **unbounded** — no
  TTL, no archival, no cleanup job. before_data/after_data hold full
  transaction snapshots, so it is itself a growing store of financial PII.
- Financial data in IndexedDB is explicitly set never to expire
  (storageAdapter.ts:199) — correct while the account is active, but there's
  no defined post-closure purge window.
- **Recommendation**: define and document retention (e.g. audit log retained
  N years for financial-compliance reasons, then purged; closed-account data
  purged after the legal minimum). A scheduled job can enforce it.

---

## What's already good ✅
- Encryption at rest for financial data (IndexedDB, AES via crypto-js)
- RLS per-user isolation (once the P0 rollout migration is applied)
- Sentry Replay masks all text, inputs, and media
- No PII in URLs; secrets server-only after the P0 work
- Inline rectification of all records

---

## Priority order for the human/legal track
1. 🔴 Privacy policy + terms, surfaced at sign-up (legal/content task)
2. 🔴 Self-service account deletion endpoint + UI (engineering — I can build this)
3. 🔴 Cookie/tracking consent banner gating Sentry Replay (engineering — I can build this)
4. 🟠 "Export everything" JSON for portability/SAR (engineering — small)
5. 🟠 DPAs with all five processors + residency confirmation (legal/ops)
6. 🟠 Documented retention + enforcement job (engineering + policy)

Items 2, 3, and 4 are buildable now if you want them in this branch; 1 and 5
need your input/legal sign-off; 6 needs a policy decision on the numbers.
