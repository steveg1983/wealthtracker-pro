# Clerk Production — the record of what EXISTS

**Rewritten 2026‑08‑29.** Until this rewrite, this file opened with "production
runs Clerk's *development* instance" and laid out the plan to fix that. The
plan had been **carried out in full around 26 August** — production instance,
DNS, DKIM, all three social providers with custom credentials, live keys in
Vercel — and the stale opening misled a full day of planning on the 29th: a
worked migration path was drafted for a problem that no longer existed. A
runbook that has been run is a different document from one that hasn't, and
this is that document now.

## What is live (verified 29 Aug 2026)

- **The production Clerk instance is fully live.** The shipped bundle carries
  `pk_live_…` (verified by grepping the served production JS, not by memory),
  every Clerk CNAME and email record resolves, and the sign-up modal carries no
  "Development mode" banner.
- **Apple, Google and Microsoft sign-in all work on production** with our own
  provider credentials (owner confirmation, 29 Aug: "we went through the
  process with Google / Microsoft and Apple to get them working"). The original
  failure — Apple sign-in spinning forever on iPhone Safari because the dev
  instance's shared `accounts.dev` credentials sat in a third-party context ITP
  blocks — is cured by construction: production auth is first-party on our
  domain.
- **The Supabase JWT bridge exists on the production instance** — same claims
  and signing config the RLS policies expect. Production sign-ins read and
  write their own rows and only their own rows (verified with the App Review
  account).
- **Vercel production env**: `VITE_CLERK_PUBLISHABLE_KEY` = `pk_live_…`,
  `CLERK_SECRET_KEY` = `sk_live_…` (server only — never a `VITE_` prefix; that
  prefix inlines a var into the public bundle and has leaked a master key
  before).

## The traps that remain true — read before touching anything

- **`.env.local` on the Mac still holds the DEV instance's `CLERK_SECRET_KEY`.**
  Any local script that talks to Clerk (seeders included) is talking to a ghost:
  it will succeed against the dev instance and the production app will see
  nothing. This burned a seeding run on 29 Aug — the demo user was created on
  the wrong instance and had to be repointed by SQL. Swap the key, or expect
  every Clerk-touching script to lie until it is swapped.
- **Production is a separate user table from dev.** A person who existed on the
  dev instance gets a brand-new `user_…` id the first time they touch
  production, the app finds no `users` row for it and creates an empty one —
  and their first impression is an empty ledger. The cure is a repoint, proven
  twice on 29 Aug (the App Review account, then Danielle):
  1. Find their data row and the stray empty row:
     `SELECT id, clerk_id, email, created_at FROM users WHERE email ILIKE '<theirs>'`
     (plus per-row transaction counts to see which row holds the data).
  2. Delete the stray empty row FIRST (clerk_id is unique), pinned by both id
     and clerk_id.
  3. `UPDATE users SET clerk_id = '<new production id>' WHERE id = '<data row>'`.
  4. They close and reopen the app; everything is there. Their internal
     `users.id` never changes, so subscriptions and all data stay attached.
  To avoid even the transient empty first look: create their user in the
  production Clerk dashboard BEFORE inviting them (mints the new id with no
  action from them) and repoint in advance.
- **`AUTHORIZED_PARTIES` must list every origin the app is served from.** Stale
  origins after a domain change 401 every API route for every user while the
  Clerk dashboard shows all green (this outage has happened — see memory /
  incident notes). Check it FIRST after any domain work.
- **Clerk prod dies if the DNS records go.** The CNAMEs are load-bearing;
  removing them breaks auth in production immediately.

## Housekeeping still owed (as of 29 Aug 2026)

- Rotate the Clerk admin key the July security audit found committed — still
  outstanding.
- Swap `.env.local`'s `CLERK_SECRET_KEY` dev→prod (see trap one).
- Delete the stray demo user created on the dev instance during the 29 Aug
  seeding mix-up.

## If a NEW provider or a new domain is ever added

The one-time provider work (consent screens, redirect URIs, Apple's Services
ID + `.p8` key dance) was done per Clerk's own dashboard instructions — Clerk's
"Use custom credentials" page for each provider shows the exact callback URL to
paste into the provider console, and that page, not this file, is the source of
truth for the values. Apple's return URL must match Clerk's exactly, scheme and
path. Google's consent screen must be published ("In production"), or every
sign-in shows an unverified-app interstitial; verification review is only
needed for sensitive scopes, which sign-in is not.
