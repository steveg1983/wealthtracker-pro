# WealthTracker Post-Rollout Re-Audit — Consolidated Findings

## Executive Summary

The 24-hour rollout substantially improved the app's security and integrity posture: RLS data-isolation is now real for the live financial and TrueLayer banking tables, atomic balance/audit RPCs are the canonical write path for interactive use, Sentry covers the client, and GDPR features landed. **However, the app is not yet production-ready.** Three issues are serious enough to block a confident launch: a critical money-corruption bug in the transaction edit flow (positive expense amounts double-swing the balance), the bank-sync ingestion path that bypasses both the atomic balance adjustment and the financial audit log (breaking the very balance invariant and audit-completeness guarantees the rollout established), and several RLS/authorization gaps the hardening migration missed (legacy Plaid tables holding plaintext bank tokens left world-readable to the anon key; a banking-ops admin gate that fails open on preview deployments). Server-side observability is also a real hole — no serverless errors reach Sentry, so silent cron/sync failures are invisible. The top risks are **money correctness** (edit + bank-sync), **data isolation completeness** (missed tables), and **operational blindness** (no server alerting). None are catastrophic given the live-table hardening that did land, but the edit bug and bank-sync invariant break should gate release.

---

## Critical

### 1. EditTransactionModal stores expenses as positive — corrupts sign and double-swings balance
**`src/components/EditTransactionModal.tsx:109`** (contrast `AddTransactionModal.tsx:72`)
The edit form seeds `amount: Math.abs(transaction.amount)` (line 53), so `parsedAmount` is always positive. On submit for a non-transfer expense, line 109 forwards `parsedAmount` unchanged with `type:'expense'` and never applies `-Math.abs()`. Since expenses are stored signed-negative and `update_transaction_atomic` adjusts `balance + (new − old)`, editing a −£100 expense re-saves it as +£100: the stored sign flips (corrupting type/reporting) and the balance swings by ~2× the magnitude in the wrong direction. The modal is live on Transactions and AccountTransactions pages.
**Fix:** Sign the amount by resolved type before building `transactionData`, mirroring AddTransactionModal line 72: `amount = resolvedType === 'expense' ? -Math.abs(parsedAmount) : (resolvedType === 'income' ? Math.abs(parsedAmount) : signedTransferAmount)`.

---

## High

### 2. Bank-sync inserts transactions directly, bypassing the atomic balance RPC and audit log
**`api/banking/sync-transactions.ts:311-333`** (cf. `create_transaction_atomic`, `supabase/migrations/20260610150000_financial_audit_log.sql:106`)
Bank imports use a plain `supabase.from('transactions').insert(...)` with zero `rpc(`/`balance` references in the handler. They never adjust `accounts.balance` and never write `financial_audit_log`. So after every sync `balance ≠ initial_balance + Σtxns` (the exact invariant the 2026-06-11 data audit just repaired to 4/4), and a whole class of money-creating events is unaudited. The full-sync flow masks the displayed-balance error because `sync-accounts` overwrites balance from TrueLayer, but the `syncTransactionsOnly` path leaves the stored balance stale.
**Fix:** Route bank-sync inserts through `create_transaction_atomic` (or a dedicated bulk RPC) so insert + `balance = balance + amount` + audit-log write commit atomically.

### 3. RLS hardening misses legacy Plaid tables holding a plaintext bank token — anon key can read/write `plaid_connections.access_token`
**`supabase/migrations/20260610130000_restore_rls_data_isolation.sql` (DROP loop lines 64-75)** + **`20251030003814__initial-schema.sql:681, 2069/2090/2139/2160`**
`plaid_connections` is defined with `access_token text NOT NULL` (plaintext bank OAuth token) and its four policies are all `USING (true)` / `WITH CHECK (true)` with **no `TO` clause**, so they apply to anon AND authenticated. The hardening migration's DROP loop enumerates 22 tables but omits `plaid_connections`/`plaid_accounts`/`plaid_webhooks`, despite the migration comment claiming it "removes every permissive policy." Net result: the public anon key shipped in `dist/` can SELECT/INSERT/UPDATE/DELETE every row of these tables — the identical `USING(true)` vuln class the rollout claims to have closed. Impact is bounded because the live banking path uses TrueLayer (no `plaid_*` references in `src/` or `api/`), so the tables are likely empty — but the structural hole is real and anon-exploitable.
**Fix:** Add the three plaid tables to the hardening DROP-all loop and either DROP the legacy tables or recreate them service_role-only; extend `scripts/pentest.mjs` to probe them.

### 4. `dashboard_layouts` and `widget_preferences` retain `USING(true)` RLS — cross-user read/write
**`supabase/migrations/20251030003814__initial-schema.sql:2062/2083/2132/2153` (dashboard_layouts), `2111/2167` (widget_preferences)**
Same root cause as #3: these tables have blanket permissive policies with no `TO authenticated` restriction and are absent from the hardening migration's DROP list, so the anon role and any authenticated user can read/write **all** users' UI/layout config. Unlike the Plaid tables, these are wired as live (referenced in `backup-database.mjs`/`delete-user.mjs`), so this is an active cross-user data-isolation gap, not a dead-table latent one.
**Fix:** Include these tables in the hardening DROP-all loop and replace with per-user policies keyed on `requesting_user_id()`.

### 5. Banking-ops admin endpoints fail OPEN on non-production deployments when allowlist is unset
**`api/_lib/banking-ops.ts:83-91`** (`if (admins.size === 0) return !isProductionRuntime();`)
When `BANKING_OPS_ADMIN_CLERK_IDS` is empty, `isBankingOpsAdmin` returns `!isProductionRuntime()` — TRUE for any non-production runtime (preview/development). `requireBankingOpsAdmin` is the sole authorization on privileged endpoints (dead-letter-admin which can reset **all** users' bank connections via the service-role client, audit, audit-export, ops-alert). Preview deployments share the live Supabase project, so any signed-in user on a preview build with the var unset can list/reset every user's bank connections. (Production fails closed by default — the exposure is the preview path.)
**Fix:** Fail CLOSED: when the allowlist is empty, return `false` in all runtimes; require `BANKING_OPS_ADMIN_CLERK_IDS` to be explicitly configured.

### 6. Stripe webhook: transiently-failed events are acknowledged and never reprocessed
**`api/stripe/webhook.ts:149-168`**
The event row is inserted `processed:false` before handling. If `syncSubscription` throws, the row stays `processed:false` and the handler returns 500. On Stripe's retry the INSERT hits the UNIQUE `event_id` conflict (23505) and returns `200 {duplicate:true}` **without checking the processed flag** — so the failed event is acked and never retried. A failed `checkout.session.completed` means the customer paid but their tier/status is never written (e.g. the known race where the Clerk-created `users` row doesn't yet exist). Result: silent permanent entitlement loss for a paying user.
**Fix:** On 23505 conflict, SELECT the existing row; reprocess if `processed=false` and only short-circuit when `processed=true`.

### 7. Server-side (api/) errors are not captured by Sentry — only the client is instrumented
**`package.json` (only `@sentry/react`); zero Sentry imports across `api/`**
`grep -rln sentry api/` returns nothing and there's no `@sentry/node`/`@sentry/vercel`. Every serverless failure logs to console only: `retention.ts:37`, `reconcile.ts`, `sync-transactions.ts:352-372`. Cron failures (GDPR retention purge, Stripe reconcile) and bank-sync failures produce no alert and are visible only by manually reading Vercel logs. The prior "Monitoring RESOLVED" claim covered only the client tier.
**Fix:** Add `@sentry/node` (or Sentry's Vercel wrapper), init in `api/_lib`, and wrap cron + banking handlers so server exceptions are captured and alertable.

### 8. Primary list/grid navigation items are clickable `<div onClick>` with no keyboard support (WCAG 2.1.1 A)
**`src/pages/Accounts.tsx:315-318, 372-375`; `Investments.tsx:374-377`; `Analytics.tsx:485-487`**
Account cards, investment-account rows, and saved-dashboard cards are interactive controls implemented as bare divs with no `role="button"`, `tabIndex`, or `onKeyDown` — unreachable by keyboard and invisible to screen readers as controls, with no parallel keyboard path. `axe-core` does not flag a div-with-onClick, which is why the automated audit reported 0 violations. The codebase already has the correct pattern (`Calendar.tsx:243-256`), so this is a consistency miss in a WCAG 2.1 AA-targeting app.
**Fix:** Convert to `<button>` (or add `role="button"` + `tabIndex={0}` + Enter/Space `onKeyDown`), mirroring the Calendar fix.

### 9. Production-to-prod-Clerk cutover will break auth: CSP and Supabase Third-Party-Auth pinned to the dev Clerk domain
**`vercel.json:60`, `src/security/csp.ts:59`, `supabase/migrations/20260610130000_restore_rls_data_isolation.sql:11-20`**
CSP `script-src`/`connect-src` whitelist only `https://*.clerk.accounts.dev` (+ clerk.com). A production Clerk instance serves its Frontend API from a customer CNAME subdomain not covered by that pattern, so clerk-js and all auth XHR will be CSP-blocked and login breaks. Separately, Supabase Third-Party-Auth issuer and `CLERK_SECRET_KEY` are instance-bound; if not reconfigured in lockstep the RLS app fails **closed** (no data access). Forward-looking cutover hazard, additive to the known "prod on Clerk dev instance" item.
**Fix:** Before cutover, add the production Clerk frontend domain to CSP, update the Supabase Third-Party-Auth issuer, and rotate `CLERK_SECRET_KEY`/publishable key together as one coordinated step.

---

## Medium

### 10. Legacy Plaid `access_token` stored in plaintext (not encrypted), on a permissive-RLS table
**`supabase/migrations/20251030003814__initial-schema.sql:681`** — `access_token text NOT NULL` vs live `bank_connections.access_token_encrypted`. Combined with #3's surviving `USING(true)` RLS, any plaintext Plaid token in this table is anon-readable. Likely dead (no code paths populate it), so latent rather than live.
**Fix:** Drop the legacy plaid tables, or if retained, encrypt the token column and lock RLS to service_role only.

### 11. Float money arithmetic persisted in bank-sync amounts
**`api/banking/sync-transactions.ts:84-89`** — `normalizeAmount` does `Math.round(value * 100) / 100` (IEEE-754) and writes the result straight into `transactions.amount`. The 2026-06-10 money-math sweep missed this server-side path; it bypasses `parseMoneyInput`/Decimal. Wrong-penny only triggers on 3rd-decimal `.xx5` float boundaries (uncommon for clean 2dp bank data), so latent.
**Fix:** Round with Decimal.js (2dp HALF_UP) before persisting, matching the client `parseMoneyInput` contract.

### 12. Bank-sync inserts transactions without adjusting balance, while link/sync overwrite balance from bank — divergence risk
**`api/banking/sync-transactions.ts:311-333`** (no balance update) vs **`api/banking/link-accounts.ts:99-100`** and `sync-accounts.ts:117-121` (force-set `balance := bank_balance`). A manual transaction added to a bank-linked account bumps balance via RPC, then the next link/sync overwrite silently discards that delta; the schema's separate `bank_balance` reconciliation column is collapsed into `balance`. Dual source of truth.
**Fix:** Pick one authority per account (bank balance read-only, or reconcile `bank_balance` separately from the transaction-derived balance) and document the invariant.

### 13. Bank-imported money mutations write no `financial_audit_log` entry
**`api/banking/sync-transactions.ts:311-333`** — the audit log is written only by the atomic RPCs; raw bank inserts (and `sync-accounts` balance overwrites) emit none, so "all money mutations are audited" doesn't hold. (Overlaps #2; called out separately as a compliance gap.)
**Fix:** Route the bank-sync write path through the audit-emitting RPC, or explicitly call `write_financial_audit` for each inserted/updated bank transaction and balance overwrite.

### 14. Bundle-size gate is a no-op
**`scripts/bundle-size-check.mjs:59`** (`process.exit(0)`, no budget) + **`.github/workflows/handoff-snapshot.yml`** ("Run bundle check" is `continue-on-error: true`). CLAUDE.md advertises a Bundle Check gate that doesn't exist; the main chunk is already ~1,025 KB raw with a separate 551 KB chunk and nothing prevents growth.
**Fix:** Add a hard gzipped budget (e.g. main ≤200 KB gz) that exits non-zero, and remove `continue-on-error` from the CI step.

### 15. gitleaks allowlist whitelists all Stripe test secret keys and the entire workflows directory
**`.gitleaks.toml:9-10, 19`** — `sk_test_…` is allowlisted globally and `^.github/workflows/.*$` is excluded entirely, so a real credential pasted into a workflow YAML wouldn't be flagged. Combined with gitleaks-action v2's diff-only push scan, this weakens detection of the known unrotated history secrets.
**Fix:** Drop the `sk_test_` allowlist and the blanket workflows-path exclusion; scope allowlists to specific known-placeholder strings only.

### 16. "Add Goal" / "Add Investment" primary CTAs are keyboard-inaccessible divs with no accessible name
**`src/pages/Goals.tsx:160-192`; `src/pages/Investments.tsx:160-164`** — primary CTAs are `<div onClick … title="Add Goal">` with no `role`/`tabIndex`/`onKeyDown`/`aria-label` (a `title` is not a reliable accessible name). Keyboard and screen-reader users cannot open these modals at all.
**Fix:** Replace each wrapper div with `<button type="button" aria-label="Add goal">`, keeping the SVG as an `aria-hidden` child.

### 17. Open redirect via unvalidated Origin header in billing-portal return URL fallback
**`api/billing/portal.ts:42-46`** — when `body.returnUrl` is absent, the client-controlled `Origin` header builds the Stripe `return_url` with no `isRedirectUrlAllowed()` check (which *is* applied to `body.returnUrl`). Exploitability is constrained (requires the attacker's own Clerk token; they only redirect themselves), so it's an input-validation defect rather than a cross-user attack.
**Fix:** Validate the Origin-derived fallback through `isRedirectUrlAllowed()` too, or drop the fallback and require a validated `returnUrl`.

### 18. Rate limiter is ineffective: per-instance in-memory state, keyed on spoofable leftmost `x-forwarded-for`
**`api/_lib/rate-limit.ts:17, 20-26, 50-52`** — state is a module-level Map per serverless instance (limits multiply by instance count), and the key is the leftmost (client-supplied) XFF entry, so rotating the header yields a fresh bucket. Guards on account-delete (3/min), create-checkout (10/min), exchange-token are abuse/cost brakes only (endpoints remain auth-gated), so impact is cost/abuse amplification, not unauthorized access.
**Fix:** Back the limiter with a shared store (Upstash/Redis); derive client IP from `x-real-ip`/the trusted rightmost hop; key destructive endpoints on authenticated `userId`.

### 19. Raw Supabase/DB error details leaked to clients in banking handlers
**`api/banking/sync-transactions.ts:25-31, 294-295, 322-328`; `link-accounts.ts:107`** — `createErrorResponse` ships the raw Supabase error object (schema/column internals) to the client, and link-accounts interpolates `updateError.message` into the response body. `delete-transaction.ts` already does the safe thing (log server-side, return generic message + code).
**Fix:** Log raw errors server-side only; return a generic message + stable code to the client.

### 20. Production code logs raw bank transaction data (financial PII) to function logs
**`api/_lib/truelayer.ts:261`** (`console.log('[truelayer] first transaction sample:', JSON.stringify(results[0]).slice(0,300))`) + `sync-transactions.ts:164/197/232/309`. The sample dumps a real transaction's amount/description/merchant into Vercel logs on every sync — a finance-app GDPR concern, in an uncontrolled log sink.
**Fix:** Delete the transaction-sample log; route sync-stage logs through a gated debug logger; never serialize transaction bodies.

### 21. Bank reconnect UX is wired to a `reauth_required` status the backend never writes
**`api/_lib/banking-sync.ts:124-138`, `connections.ts:36/66`, `src/components/BankConnections.tsx:318/327`** — only `connected`/`error` are ever persisted; no code path sets `reauth_required`/`needs_reauth=true`, and `connections.ts` doesn't even SELECT `needs_reauth`. An expired connection shows `error` with an enabled (always-failing) Sync button and **no** Reauthorize prompt.
**Fix:** In the refresh-failure branch, set `status='reauth_required'`/`needs_reauth=true` on token/refresh/401 failures and surface `needs_reauth` through `connections.ts` so the existing Reauthorize CTA appears.

### 22. Token-refresh failure not classified as needs-reauth; refresh only triggered on a literal 401
**`api/_lib/banking-sync.ts:15-20, 50-88, 90-106`** — refresh is attempted only when the error message matches `/\b401\b/`; an expired/absent refresh token (and TrueLayer `invalid_grant`, which is HTTP 400) throws a generic error recorded as `error`. No distinction between "transient, retry later" and "user must re-link." (Overlaps #21 — same dead reauth path.)
**Fix:** Classify TrueLayer `invalid_grant`/refresh failures explicitly and persist `needs_reauth=true` + `status='reauth_required'`; only treat genuinely transient errors as retryable.

### 23. Errored bank connections silently no-op as "success" when linked accounts are missing
**`api/banking/sync-transactions.ts:165-182, 199-208`** — if `linkedAccounts.length === 0` or none map to user accounts, the handler calls `markConnectionSyncSuccess` and returns `{success:true, transactionsImported:0}`, clearing any prior error and flipping status back to `connected`. A genuinely broken connection is masked as a clean sync.
**Fix:** Treat zero usable linked accounts on an existing connection as a distinct degraded/warn state, not an unconditional success.

### 24. No scheduled backup — DR scripts are manual-only, RPO unbounded
**`vercel.json` crons (only reconcile + retention); `package.json:71-73` (`backup:db`/`dr:drill` never invoked on a schedule)** — `grep -rln backup:db .github/` returns nothing. The DR audit itself states RPO is "Unbounded — backups exist only when run by hand." (Real-world RPO depends on unconfirmed Supabase plan PITR.)
**Fix:** Wire a nightly scheduled job (GitHub Action with the service-role key as a secret, or launchd) to run `npm run backup:db`; confirm Supabase PITR status.

---

## Low

### 25. `update_transaction_atomic` has no `user_id` scoping — latent IDOR under service_role
**`supabase/migrations/20260610150000_financial_audit_log.sql:~135-165`** — unlike `delete_transaction_atomic` (which takes `p_user_id` and scopes it), update selects/updates purely `WHERE id = p_id` with no user filter. Today the only caller is the authenticated (RLS-scoped) client and no service-role path invokes it, so it's a latent footgun, not currently exploitable.
**Fix:** Add `p_user_id uuid DEFAULT NULL` and scope both SELECT FOR UPDATE and UPDATE with `AND (p_user_id IS NULL OR user_id = p_user_id)`, mirroring delete.

### 26. Dead float-math balance code retained in live `src/` (banned by CLAUDE.md)
**`src/utils/recalculateBalances.ts:16-26, 41`** (+ dead `AppContext.tsx`, `AppStepByStep.tsx`, `config/database.ts`) — raw IEEE-754 float money math with an expense-sign convention that contradicts the live signed-negative model. Provably unreachable from the production bundle (entry uses `AppContextSupabase`), so no live impact, but a banned-pattern + revival footgun.
**Fix:** Delete the four dead files (and orphaned tests), or rewrite using Decimal + the signed-amount convention if a local-mode provider is still wanted.

### 27. `AccountService.recalculateBalance` recomputes balance with float, bypassing the RPC/audit
**`src/services/api/accountService.ts:320-353, 290-318`** — float `reduce` sum written straight to `accounts.balance` via `.update()` with no audit. Exported as a public static API but currently has no in-app caller (not in the `DataService` Pick type), so dead — a latent foot-gun that would overwrite a correct ledger balance.
**Fix:** Reimplement as a numeric SQL/RPC (`balance = initial_balance + sum(amount)`, audited), or remove the unused method.

### 28. Single-account soft-delete is not user-scoped and orphans transactions
**`src/services/api/accountService.ts:244-254`** (`.update({is_active:false}).eq('id', id)` — no `.eq('user_id', …)`) + `AppContextSupabase.tsx:372-382` (drops transactions from React state without a DB write). RLS-scoped today (not cross-user exploitable), but the orphaned transactions persist in the DB and keep polluting `monthlySpending`, and it's a latent IDOR if ever called service-role.
**Fix:** Add `.eq('user_id', dbUserId)` and decide a transaction-disposition policy (reassign/soft-delete/keep) instead of silently hiding them client-side.

### 29. `recalculateBalances` float math + inverted expense sign (data-money duplicate of #26)
**`src/utils/recalculateBalances.ts:16-26, 41`** — same dead util; for a stored expense of −100 it computes `balance − (−100) = +100`, inverting every expense. Dead path (localStorage provider not mounted in production). De-duplicated with #26 — same fix.

### 30. Account-delete leaves orphaned `subscription_logs` rows (GDPR erasure completeness)
**`api/account/delete.ts:104-140`** — `subscription_logs` (keyed by `event_id`, no `user_id`) is never deleted. The retained `payload` is non-PII (`{type, created}` only) and `subscription_events` is actually double-CASCADE'd, so the real residue is non-user-linkable rows — a minor erasure-completeness gap, not a data leak.
**Fix:** Delete `subscription_logs` rows tied to the user's events, or document that they hold no PII; enforce `subscriptions.user_id NOT NULL`.

### 31. `ResponsiveModal` can render a dialog with an empty accessible name
**`src/components/common/Modal.tsx:143, 149-154`** (`aria-labelledby="modal-title"` set unconditionally; `<h2>` always rendered) — when `title` is empty, screen readers announce only "dialog." Latent via ResponsiveModal (its only caller passes a real title) but **live** via `GoalCelebrationModal.tsx:45` which passes `title=""`.
**Fix:** In `Modal.tsx`, only set `aria-labelledby` when `title` is non-empty; ensure callers pass a real title.

### 32. `MobileBottomSheet` has no focus trap
**`src/components/MobileBottomSheet.tsx:128-130`** — `role="dialog"` + `aria-modal="true"` but no Tab-trapping logic, so on <768px viewports keyboard/switch users can Tab out into the inert page behind the open sheet (Escape-to-close mitigates).
**Fix:** Reuse the existing `src/components/common/useFocusManager.ts` trap, or port the common Modal's focus-trap logic.

### 33. Recharts charts have no text alternative or data-table fallback
**`src/components/charts/DashboardCharts.tsx:61, 112`** — charts pass only `aria-label`; no `role="img"` wrapper and no visually-hidden data `<table>`. (Note: recharts 3.x enables `accessibilityLayer` by default, so keyboard/arrow navigation of data points already works — the real gap is a static, complete text alternative of the numbers.)
**Fix:** Add a visually-hidden data `<table>` beside each chart and/or wrap in `role="img"` with a data-summarizing label.

### 34. Coverage gate silently lowered to 63% statements, contradicting the documented 75% bible
**`.github/workflows/handoff-snapshot.yml:96`, `package.json:69`** (`--statements=63`) vs CLAUDE.md's "≥75% / 77.6% current." Documentation drift, not a functional defect; the recalibration (deleting well-tested dead Redux code) is defensible but undercuts the "evidence-based claims" governance.
**Fix:** Restore the 75% floor or update CLAUDE.md to admit the gate is now 63% so docs and config match.

### 35. Cron handlers have no failure alerting (fail-closed on missing secret — that part is fine)
**`api/cron/retention.ts:20-23`, `api/stripe/reconcile.ts:25-28`** — a failed weekly retention purge or daily reconcile produces only `console.error`; combined with #7, cron health is unobservable. (The "fail-open if `CRON_SECRET` unset" framing is incorrect — `getRequiredEnv` throws → 500, i.e. fail-closed.)
**Fix:** Emit a captured error/alert on any cron non-success and add an external heartbeat/dead-man's-switch.

### 36. env-doctor/env-check validate only client `VITE_` vars and never exit non-zero; not wired into CI
**`scripts/env-doctor.ts`, `src/utils/env-check.ts`** — no `process.exit(1)` and no awareness of server secrets (`CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`/`WEBHOOK_SECRET`, TrueLayer creds); a missing server secret only surfaces at request time as a 500.
**Fix:** Add a server-secret presence check to a deploy/preflight step that exits non-zero, or document that server env validation is intentionally runtime-only.

---

## Repo Hygiene

### 37. 3,228+ backup/shadow-source trees still tracked in git
**`src-backup-optimized/`, `src.backup.20251027_195258/`, `WealthTracker-Backups/`, plus `src/contexts/AppContext.tsx.backup`/`.original`** — full duplicate app trees (with old float-based code, 439 files containing `parseFloat`) and `.backup`/`.original`/`.bak` files inside the live tree. The actual count exceeds the cited 3,228 (~8,495). These don't compile into the bundle (hygiene, not security), but violate CLAUDE.md RULE #2 and create accidental-revival risk. Includes tracked `WealthTracker-Backups/.../v2.0.0/.env.production` (currently only public `VITE_` keys, but a standing secret-leak footgun).
**Fix:** `git rm -r` the shadow trees and `.backup`/`.original`/`.bak` files; add them to `.gitignore`.

---

## Already-Known — Accept or Schedule

| Item | Status & Recommended Disposition |
| --- | --- |
| **Git-history secrets (unrotated, still valid)** | **Schedule now — highest of the known items.** Anon/publishable keys are client-safe, but if any `service_role` key or `SUPABASE_DB_URL` is in history it's a live data-isolation bypass. Rotate all server-side secrets and treat history as compromised; this is more urgent than several Medium findings above. |
| **Manual cross-user/IDOR pentest never executed** | **Schedule before launch.** Findings #3–#5 show the automated `pentest.mjs` has blind spots (doesn't probe `plaid_*`, `dashboard_layouts`, `widget_preferences`). Run a manual two-user IDOR pass against every table and the banking-ops endpoints; this would have caught #3–#5. |
| **Production on Clerk DEV instance** | **Schedule — blocks GA, coordinate with #9.** The dev instance has weaker limits/security and the cutover is itself a hazard (#9). Migrate as one coordinated change: prod Clerk keys + CSP domains + Supabase issuer together. |
| **Privacy/Terms pages DRAFT pending legal** | **Accept short-term, schedule for GA.** Acceptable for preview/beta; must be finalized by legal before public launch given GDPR features are live. No code risk. |

---

## What's Genuinely Solid (verified)

The hardening that landed is real where it counts. The **live** financial tables (`transactions`, `accounts`, `users`, `budgets`, `goals`, `categories`) and the **active** TrueLayer banking tables (`bank_connections`, `linked_accounts`, `sync_history`) now carry per-user RLS keyed on `requesting_user_id()` — the `USING(true)` holes that survived are confined to legacy/dead Plaid tables and UI-config tables, not the core money data. The atomic RPCs (`create/update/delete_transaction_atomic`) correctly do `balance = balance + delta` in SQL numeric and emit `financial_audit_log` entries, and every *interactive* transaction path routes through them — so manual user activity has both a correct balance invariant and a real audit trail (the gaps are specifically the bank-sync ingestion path, #2/#13). `delete_transaction_atomic` and the service-role `delete-transaction` handler correctly pass and scope `p_user_id`, showing the team understood service-role scoping (the `update` omission in #25 is an oversight against an otherwise-correct pattern). The cron auth is properly fail-closed, client-side Sentry is genuinely wired, the GDPR `subscription_events` erasure path is correctly double-CASCADE'd, and the Decimal-based client money path (`parseMoneyInput`, `calculations-decimal.ts`) is sound. This is a meaningful, verifiable step up from the pre-rollout state — the remaining work is closing the bank-sync integrity gap, finishing the RLS sweep over the tables the migration missed, fixing the edit-amount sign bug, and adding server-side observability.