# P0 Security Remediation — Rollout Guide

Status of the three CRITICAL audit findings (see AUDIT_2026-06-10.md) and the
exact order to finish the rollout. Code work is DONE; the remaining steps are
dashboard actions only you can perform.

---

## ✅ Done in code (this branch)

1. **Service-role key removed from client**
   - `VITE_SUPABASE_SERVICE_ROLE_KEY` deleted from `src/vite-env.d.ts` and
     `src/utils/env-check.ts` (and `VITE_STRIPE_SECRET_KEY` declaration removed)
   - `api/_lib/supabase.ts` now reads server-only `SUPABASE_SERVICE_ROLE_KEY`
     (legacy name accepted temporarily as fallback)
   - Scripts, smoke-test runner, and CI workflow renamed to the new variable
   - `.env.local` / `.env.test.local` renamed locally
   - **Verified: built bundle contains zero occurrences of `service_role`**

2. **Secrets untracked from git**
   - `.env.local` and `.env.test.local` removed from the git index
   - `.gitignore` now blocks all `.env*` (except `.env.example`)
   - `.env.example` added documenting every variable WITHOUT values

3. **Clerk→Supabase token bridge implemented**
   - `src/lib/supabaseToken.ts` (new): registry the Supabase clients read
   - Both Supabase clients (`src/lib/supabase.ts`,
     `src/services/api/supabaseClient.ts`) now send the Clerk session JWT via
     the `accessToken` option
   - `AuthContext` registers the live session's `getToken` on sign-in and
     clears it on sign-out
   - Dead `getCurrentUserId` (broken `supabase.auth.getUser()`) removed

4. **RLS hardening migration written (NOT yet applied)**
   - `supabase/migrations/20260610130000_restore_rls_data_isolation.sql`
   - Drops every existing policy on 22 tables dynamically (immune to
     repo↔production policy-name drift), then creates per-user policies
     keyed on the Clerk JWT `sub` claim
   - Banking token tables and billing write-paths become service-role-only

5. **Subscription constraint contradiction fixed (migration written)**
   - `supabase/migrations/20260610120000_fix_subscription_constraint_contradictions.sql`
   - 'premium' tier and 'cancelled' status become storable

6. **Route guards** — `/open-banking`, `/settings/*`, `/subscription` now wrapped
   in `ProtectedSuspense`; duplicate dead route removed

---

## 🔴 YOUR ACTIONS — in this exact order

### Step 1 — Rotate every leaked secret (do this first, today)
The old values are in git history and the old service-role key was in built
bundles. Rotate ALL of these:

| Secret | Where to rotate |
|---|---|
| Supabase service-role key | Supabase dashboard → Settings → API → "Reset" service_role |
| Supabase anon key | Same page → reset anon (then update `.env.local` + Vercel + GitHub secrets) |
| Clerk secret key | Clerk dashboard → API Keys |
| `ENCRYPTION_KEY` | Generate new; re-encrypt stored bank tokens or force re-link |
| `BANKING_STATE_SECRET` | Generate new (in-flight OAuth flows will restart) |
| TrueLayer client secret | TrueLayer console |

### Step 2 — Update environment variables everywhere
- **Vercel** → Project → Settings → Environment Variables:
  - Delete `VITE_SUPABASE_SERVICE_ROLE_KEY`
  - Add `SUPABASE_SERVICE_ROLE_KEY` (new rotated value) — server-side only
- **GitHub** → repo Settings → Secrets and variables → Actions:
  - Rename secret `VITE_SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`
- **Local**: `.env.local` already renamed (put the NEW rotated values in)

### Step 3 — Configure Clerk ↔ Supabase third-party auth
1. **Clerk dashboard** → Configure → Integrations → enable **Supabase**
   (this adds the `"role": "authenticated"` claim Supabase requires)
2. **Supabase dashboard** → Authentication → Sign In / Providers →
   **Third-Party Auth** → Add provider → **Clerk** → enter your Clerk domain
   (e.g. `your-app.clerk.accounts.dev` or your production Clerk domain)

### Step 4 — Deploy the frontend (this branch)
Deploy BEFORE applying the RLS migration. The token bridge is harmless under
the current permissive policies, and it must be live before isolation turns on.

### Step 5 — Apply the two migrations (in order)
```bash
# from the repo root, with SUPABASE_DB_URL set
npm run db:migrate
```
Applies:
1. `20260610120000_fix_subscription_constraint_contradictions.sql`
2. `20260610130000_restore_rls_data_isolation.sql`

### Step 6 — Verify isolation
- Sign in as user A → data loads normally
- Open an incognito window, do NOT sign in, and with only the anon key try:
  `curl '<SUPABASE_URL>/rest/v1/transactions?select=*' -H "apikey: <ANON_KEY>"`
  → must return `[]`
- Sign in as a second test user → must see no user-A data
- Banking pages still work (api/ handlers use the service role)

### Step 7 — Purge git history (coordinate before doing)
The committed `.env.local` remains in history until purged:
```bash
# DESTRUCTIVE — rewrites history; coordinate with anyone who has clones
pip install git-filter-repo
git filter-repo --invert-paths --path .env.local --path .env.test.local
git push --force --all && git push --force --tags
```
Since secrets are rotated in Step 1, history purging is hygiene rather than
emergency — but do it.

### Step 8 — Remove the legacy fallback (after Vercel var renamed)
Delete the `VITE_SUPABASE_SERVICE_ROLE_KEY` fallback in `api/_lib/supabase.ts`
and in the three `scripts/*.mjs` files + `scripts/run-supabase-smoke.mjs`.

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| App shows no data after Step 5 | Step 3 or 4 skipped/incomplete | Check Clerk integration + Supabase third-party auth config; confirm the deployed bundle includes the token bridge |
| 401s from Supabase | Clerk token missing `role` claim | Re-check Step 3.1 (Clerk Supabase integration toggle) |
| Banking sync fails | Vercel env var not renamed | Step 2 — `SUPABASE_SERVICE_ROLE_KEY` must exist in Vercel |
| Smoke tests skip | GitHub secret not renamed | Step 2 GitHub action |
