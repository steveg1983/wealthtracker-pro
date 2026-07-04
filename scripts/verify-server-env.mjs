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
 *     2026-06-12 — it must never build again.
 *   - GitHub CI / local        → report-only, exit 0 (server secrets are
 *     intentionally absent there; this is documented, not an oversight).
 *
 * EXPECTED vars warn (never fail) everywhere: some (Stripe, CRON_SECRET) are
 * known-unconfigured while that rollout is pending, and failing on them would
 * block unrelated deploys.
 */

const isVercel = process.env.VERCEL === '1';
const isVercelProd = isVercel && process.env.VERCEL_ENV === 'production';

// Hard requirements for the core data path (Supabase + Clerk auth bridge).
const REQUIRED_IN_PROD = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CLERK_SECRET_KEY'
];

// Used by api/ handlers; absence degrades a feature rather than the core app.
const EXPECTED = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_PRO_MONTHLY',
  'STRIPE_PRICE_PREMIUM_MONTHLY',
  'CRON_SECRET',
  'TRUELAYER_CLIENT_ID',
  'TRUELAYER_CLIENT_SECRET',
  'TRUELAYER_REDIRECT_URI',
  'ENCRYPTION_KEY',
  'SENTRY_DSN',
  // Shared-store rate limiter (Upstash / Vercel KV) — in-memory fallback when absent.
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN'
];

// Vars that must NOT exist: VITE_-prefixed secrets get inlined into the
// public bundle at build time.
const FORBIDDEN = ['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const missing = (names) => names.filter((n) => !process.env[n] || !process.env[n].trim());
const present = (names) => names.filter((n) => process.env[n] && process.env[n].trim());

const missingRequired = missing(REQUIRED_IN_PROD);
const missingExpected = missing(EXPECTED);
const forbiddenPresent = present(FORBIDDEN);

const ctx = isVercel ? `vercel/${process.env.VERCEL_ENV ?? 'unknown'}` : 'local/ci';
console.log(`\n🔐 Server-env preflight (${ctx})`);

if (forbiddenPresent.length > 0) {
  console.error(`✗ FORBIDDEN env var(s) set: ${forbiddenPresent.join(', ')}`);
  console.error('  VITE_-prefixed secrets are inlined into the public browser bundle.');
  console.error('  Move the value to the non-prefixed name and delete this variable.');
  if (isVercel) {
    process.exit(1);
  }
  console.error('  (Not failing outside Vercel — fix it before deploying.)');
}

if (missingRequired.length > 0) {
  if (isVercelProd) {
    console.error(`✗ Missing REQUIRED server env in production build: ${missingRequired.join(', ')}`);
    console.error('  Failing the build — these would 500 on the first request.');
    process.exit(1);
  }
  console.log(`  required-but-unset here (ok outside Vercel production): ${missingRequired.join(', ')}`);
}

if (missingExpected.length > 0) {
  console.warn(`  ⚠ expected-but-unset (feature-degrading, not fatal): ${missingExpected.join(', ')}`);
}

console.log('✓ Server-env preflight passed.\n');
