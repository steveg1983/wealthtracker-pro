# Clerk Production Runbook — social sign-in that works on phones

**Why this exists**: production runs Clerk's *development* instance (`pk_test_…` is in the
shipped bundle; the sign-up modal says "Development mode"). Dev-instance social login
(Apple / Google / Microsoft) routes through Clerk's shared credentials on `accounts.dev`
in a third-party context — which iPhone Safari's Intelligent Tracking Prevention blocks.
The button spins forever. **No code change can fix this**; the cure is a production
instance on a first-party domain. Email/password signup works on the dev instance
meanwhile.

Steps marked **[YOU]** need accounts/dashboards only you control. **[CODE]** is the app side.

## 1 · Domain **[YOU]**
- Buy/choose a domain (e.g. `wealthtracker.co.uk`). Any registrar; Vercel can also sell one.
- In Vercel → wealthtracker-web project → Settings → Domains: add `app.<domain>` (or the
  apex) and follow its DNS instructions. Verify the site loads on the new domain.

## 2 · Clerk production instance **[YOU]**
- Clerk dashboard → the WealthTracker application → "Create production instance"
  (top-right environment switcher). Choose the domain from step 1.
- Clerk will list DNS records (CNAMEs like `clerk.<domain>`, `accounts.<domain>`,
  plus email records). Add them at your DNS host, wait for Clerk to show all green.

## 3 · OAuth credentials — per provider **[YOU]**
Dev instances borrow Clerk's shared apps; production needs your own. Clerk's dashboard
(User & Authentication → Social connections → each provider → "Use custom credentials")
shows the exact **redirect URI / callback URL** to paste into each provider console —
copy it from there, not from memory.

- **Google**: console.cloud.google.com → new project → OAuth consent screen (External,
  app name, your support email) → Credentials → OAuth client ID (Web application) →
  authorised redirect URI = the one Clerk shows. Paste client ID + secret into Clerk.
- **Microsoft**: portal.azure.com → Microsoft Entra ID → App registrations → New →
  supported accounts: personal + work/school → Redirect URI (Web) = Clerk's. Create a
  client secret. Paste application (client) ID + secret into Clerk.
- **Apple** (the involved one): requires **Apple Developer Program** (£79/yr).
  developer.apple.com → Certificates, Identifiers & Profiles:
  1. Identifiers → App ID (if none) with "Sign in with Apple" capability.
  2. Identifiers → **Services ID** (this is the web client) → enable Sign in with Apple →
     configure: domains = your Clerk domains, return URL = the one Clerk shows.
  3. Keys → new key with "Sign in with Apple" enabled → download the `.p8` once.
  4. Into Clerk: Services ID, Team ID, Key ID, and the `.p8` contents.

## 4 · Keys and deploy **[CODE + YOU]**
- Clerk production API keys page: copy `pk_live_…` and `sk_live_…`.
- Vercel → project → Settings → Environment Variables (Production):
  - `VITE_CLERK_PUBLISHABLE_KEY` = `pk_live_…`  (client, safe to inline)
  - `CLERK_SECRET_KEY` = `sk_live_…`  (server only — **never** a `VITE_` prefix)
- Redeploy. The Supabase JWT bridge (Clerk JWT template → Supabase) must exist on the
  production instance too: copy the JWT template from the dev instance (Clerk dashboard →
  JWT templates) — same claims, same signing config as the dev one the RLS policies expect.

## 5 · Verification checklist
- [ ] New domain serves the app; sign-up modal **no longer says "Development mode"**.
- [ ] Email/password signup works on the new domain.
- [ ] Google sign-up completes **on desktop**.
- [ ] **Apple sign-up completes on an iPhone** (the original failure — the real test).
- [ ] Microsoft sign-up completes.
- [ ] A social-created user gets Supabase rows (userIdService mapping) and RLS holds
      (log in as them: only their data).
- [ ] Existing dev-instance users: note that production is a NEW user table — your own
      account and Danielle's live on the dev instance. Either keep dev for yourselves and
      test accounts, or re-create on production and re-run the backup/restore path
      (export from dev login, restore into prod login — ids remap on restore by design).

## Gotchas
- Clerk prod requires the domain's DNS to stay pointed; removing the CNAMEs breaks auth.
- Apple's Services ID return URL must match Clerk's *exactly* (scheme + path).
- If Google shows "unverified app" interstitials, publish the consent screen (Testing →
  In production). Verification review is only needed for sensitive scopes — sign-in isn't.
- The dev instance keeps working in parallel; nothing is lost by standing production up.
