#!/usr/bin/env node

/**
 * Server-env preflight (AUDIT_2026-06-12_DEEP_REAUDIT.md finding #36).
 *
 * Before this, server secrets (CLERK_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY,
 * Stripe/TrueLayer creds…) were validated nowhere at build time — a missing
 * one only surfaced at request time as a 500. This runs at the start of the
 * Vercel build (scripts/build-web.mjs) so a misconfigured deploy fails the
 * BUILD, not the first user request.
 *
 * Enforcement is scoped to where it can't cause false failures:
 *   - Vercel production build  → REQUIRED vars hard-fail when missing.
 *   - Any Vercel build         → the LEAK GUARD hard-fails: a VITE_-prefixed
 *     service-role var would be inlined into the public browser bundle by
 *     Vite. That exact regression shipped the master key to production on
 *     2026-06-12 — it must never build again. Since 14 Oct 2026 it also
 *     refuses any VITE_ var whose VALUE is a Stripe secret, whatever its name.
 *   - GitHub CI / local        → report-only, exit 0 (server secrets are
 *     intentionally absent there; this is documented, not an oversight).
 *
 * EXPECTED vars warn (never fail) everywhere: some (CRON_SECRET, Upstash) are
 * known-unconfigured, and failing on them would block unrelated deploys.
 *
 * STRIPE IS ALL OR NOTHING (14 Oct 2026). Until then the four Stripe vars
 * were EXPECTED like the rest, so a production build with a live secret key
 * and no price ids passed with one warning line, and the first customer found
 * out. Measured that day, both Production and Preview held NO Stripe var at
 * all, and BANKING_ALLOWED_ORIGINS — the list Checkout and the portal hold
 * their return URLs to — had never existed in Production, so the first live
 * Checkout would have answered 400. Hence the rule, chosen so that it changes
 * nothing today and everything on go-live day:
 *   - No STRIPE_SECRET_KEY → Stripe is off here. One warning, never fatal.
 *   - A STRIPE_SECRET_KEY in a Vercel PRODUCTION build → the whole go-live
 *     set must be present and the right shape, or the build fails naming
 *     each gap: the webhook secret (whsec_), both price ids (price_ — a
 *     product id, prod_, is the paste this catches), and an allow-list of
 *     exact https origins. Test key or live key alike: half a Stripe config
 *     in production is a Checkout that cannot finish.
 *   - Anywhere else, the same findings are warnings, plus one for a LIVE key
 *     outside production (a preview that can take real money).
 * Stripe values are never printed — only their names and expected prefixes.
 * Origins are public, so a malformed allow-list entry is quoted as typed.
 */

const isVercel = process.env.VERCEL === '1';
const vercelEnv = process.env.VERCEL_ENV ?? 'unknown';
const isVercelProd = isVercel && vercelEnv === 'production';

// Hard requirements for the core data path (Supabase + Clerk auth bridge).
const REQUIRED_IN_PROD = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CLERK_SECRET_KEY'
];

// Used by api/ handlers; absence degrades a feature rather than the core app.
// Stripe and the redirect allow-list are not here: they are judged as a set,
// below, because one of them without the others is worse than none.
const EXPECTED = [
  'CRON_SECRET',
  'TRUELAYER_CLIENT_ID',
  'TRUELAYER_CLIENT_SECRET',
  'TRUELAYER_REDIRECT_URI',
  'ENCRYPTION_KEY',
  'SENTRY_DSN',
  // Shared-store rate limiter (Upstash / Vercel KV) — in-memory fallback when absent.
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  // Apple push (api/_lib/apns.ts) — every push is skipped, once-logged, when absent.
  'APNS_TEAM_ID',
  'APNS_KEY_ID',
  'APNS_PRIVATE_KEY'
];

// Vars that must NOT exist: VITE_-prefixed secrets get inlined into the
// public bundle at build time. VITE_STRIPE_SECRET_KEY was declared in
// src/vite-env.d.ts until the June 2026 P0 (SECURITY_P0_ROLLOUT.md).
const FORBIDDEN = ['VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_STRIPE_SECRET_KEY', 'VITE_STRIPE_WEBHOOK_SECRET'];

// What a Stripe SECRET looks like, so a VITE_ var holding one is caught under
// any name. Publishable keys (pk_) are public by design and not matched.
const STRIPE_SECRET_VALUE = /^(sk_|rk_|whsec_)/;

// The Stripe go-live set (CLAUDE.md, "Stripe: a go-live, not a rename"), each
// with the prefix its value must carry.
const STRIPE_SET = [
  ['STRIPE_SECRET_KEY', /^(sk|rk)_(live|test)_/, 'sk_live_/sk_test_ (or rk_)'],
  ['STRIPE_WEBHOOK_SECRET', /^whsec_/, 'whsec_'],
  ['STRIPE_PRICE_PREMIUM_MONTHLY', /^price_/, 'price_'],
  ['STRIPE_PRICE_PRO_MONTHLY', /^price_/, 'price_']
];

const ALLOW_LIST = 'BANKING_ALLOWED_ORIGINS';

const value = (name) => (process.env[name] ?? '').trim();
const missing = (names) => names.filter((n) => !value(n));
const present = (names) => names.filter((n) => value(n));

/**
 * What is wrong with the redirect allow-list, as api/_lib/cors.ts will read
 * it: comma-split, trimmed, empties dropped, then matched EXACTLY against a
 * browser's Origin header — so anything that is not already a bare https
 * origin (a path, a trailing slash, a capital, a default port) never matches.
 */
const allowListProblems = () => {
  const raw = value(ALLOW_LIST);
  if (!raw) {
    return [
      `${ALLOW_LIST} is unset — only this deployment's own *.vercel.app host is trusted, ` +
        'so Checkout and the portal refuse a return URL on the real domain (400 Invalid redirect URLs).'
    ];
  }
  const entries = raw.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) {
    return [`${ALLOW_LIST} holds no origin.`];
  }
  return entries.flatMap((entry) => {
    let origin = null;
    try {
      const url = new URL(entry);
      origin = url.protocol === 'https:' ? url.origin : null;
    } catch {
      origin = null;
    }
    return origin === entry
      ? []
      : [`${ALLOW_LIST} entry ${JSON.stringify(entry)} is not an exact https origin (scheme + host, no path, no trailing slash) — it can never match.`];
  });
};

const stripeKey = value('STRIPE_SECRET_KEY');
const stripeMode = /^(sk|rk)_live_/.test(stripeKey) ? 'live' : /^(sk|rk)_test_/.test(stripeKey) ? 'test' : 'unrecognised';

/** Every reason this deployment's Stripe could not take a payment. */
const stripeProblems = () => [
  ...STRIPE_SET.flatMap(([name, shape, expected]) => {
    if (!value(name)) return [`${name} is unset.`];
    return shape.test(value(name)) ? [] : [`${name} does not start with ${expected}.`];
  }),
  ...allowListProblems()
];

const fatal = [];
const report = (line) => console.log(`  ${line}`);
const warn = (line) => console.warn(`  ⚠ ${line}`);

const ctx = isVercel ? `vercel/${vercelEnv}` : 'local/ci';
console.log(`\n🔐 Server-env preflight (${ctx})`);

// ── Leak guard ──────────────────────────────────────────────────────────────
const forbiddenPresent = [
  ...present(FORBIDDEN),
  ...Object.keys(process.env).filter(
    (n) => n.startsWith('VITE_') && !FORBIDDEN.includes(n) && STRIPE_SECRET_VALUE.test(value(n))
  )
];
if (forbiddenPresent.length > 0) {
  console.error(`✗ FORBIDDEN env var(s) set: ${forbiddenPresent.join(', ')}`);
  console.error('  VITE_-prefixed secrets are inlined into the public browser bundle.');
  console.error('  Move the value to the non-prefixed name and delete this variable.');
  if (isVercel) {
    fatal.push('a server secret under a VITE_ name');
  } else {
    console.error('  (Not failing outside Vercel — fix it before deploying.)');
  }
}

// ── Core data path ──────────────────────────────────────────────────────────
const missingRequired = missing(REQUIRED_IN_PROD);
if (missingRequired.length > 0) {
  if (isVercelProd) {
    console.error(`✗ Missing REQUIRED server env in production build: ${missingRequired.join(', ')}`);
    console.error('  Failing the build — these would 500 on the first request.');
    fatal.push('missing required server env');
  } else {
    report(`required-but-unset here (ok outside Vercel production): ${missingRequired.join(', ')}`);
  }
}

// ── Stripe, as a set ────────────────────────────────────────────────────────
if (!stripeKey) {
  const partial = present(STRIPE_SET.map(([name]) => name));
  warn(
    'Stripe is off here: STRIPE_SECRET_KEY is unset, so Checkout and the portal cannot start' +
      (partial.length > 0 ? ` (set without it: ${partial.join(', ')}).` : '.')
  );
  for (const problem of allowListProblems()) warn(problem);
} else {
  const problems = stripeProblems();
  if (problems.length > 0 && isVercelProd) {
    console.error(`✗ Stripe is configured in this production build (${stripeMode} key) but could not take a payment:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error('  Failing the build — set the rest of the go-live set in Vercel (Production), or remove the key.');
    fatal.push('an incomplete Stripe configuration');
  } else {
    for (const problem of problems) warn(`Stripe (${stripeMode} key): ${problem}`);
  }
  if (isVercel && !isVercelProd && stripeMode === 'live') {
    warn(`a LIVE Stripe key in a vercel/${vercelEnv} build — this deployment can take real money.`);
  }
}

// ── Everything else ─────────────────────────────────────────────────────────
const missingExpected = missing(EXPECTED);
if (missingExpected.length > 0) {
  warn(`expected-but-unset (feature-degrading, not fatal): ${missingExpected.join(', ')}`);
}

if (fatal.length > 0) {
  console.error(`✗ Server-env preflight FAILED: ${fatal.join('; ')}.\n`);
  process.exit(1);
}

console.log('✓ Server-env preflight passed.\n');
