/**
 * THE BUILD REFUSES HALF A STRIPE.
 *
 * `scripts/verify-server-env.mjs` is the first thing every Vercel build runs.
 * On 14 Oct 2026 it was found to WARN, never fail, on the four Stripe vars —
 * while the bible said it refused to build without them — and to know nothing
 * of BANKING_ALLOWED_ORIGINS, which had never existed in Production, so the
 * first live Checkout would have answered 400. Neither Production nor Preview
 * held a Stripe var at all that day, which fixes the shape of the rule: no
 * Stripe key is today's state and must keep building; a Stripe key in a
 * production build makes the whole go-live set mandatory.
 *
 * Each case runs the real script as a child process with a crafted
 * environment — exactly how scripts/build-web.mjs runs it on Vercel — and
 * reads the exit code a build would read. Nothing is inherited from this
 * process's env, so CI's own secrets cannot make a case pass.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = process.cwd();
const SCRIPT = join(ROOT, 'scripts/verify-server-env.mjs');

type Env = Record<string, string>;

const run = (env: Env): { status: number | null; out: string } => {
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    env: { PATH: process.env.PATH ?? '', ...env },
    encoding: 'utf8'
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
};

const PRODUCTION: Env = { VERCEL: '1', VERCEL_ENV: 'production' };
const PREVIEW: Env = { VERCEL: '1', VERCEL_ENV: 'preview' };

const CORE: Env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  CLERK_SECRET_KEY: 'clerk-secret'
};

const ORIGINS: Env = {
  BANKING_ALLOWED_ORIGINS: 'https://www.wealthtrackerpro.co.uk, https://www.reckley.co.uk'
};

// Recognisable stand-ins, so a test can prove they are never echoed.
const SECRET = 'sk_live_FAKEsecretVALUE';
const WEBHOOK = 'whsec_FAKEwebhookVALUE';

const STRIPE_LIVE: Env = {
  STRIPE_SECRET_KEY: SECRET,
  STRIPE_WEBHOOK_SECRET: WEBHOOK,
  STRIPE_PRICE_PREMIUM_MONTHLY: 'price_premium',
  STRIPE_PRICE_PRO_MONTHLY: 'price_pro',
  ...ORIGINS
};

describe('server-env preflight: Stripe is all or nothing in production', () => {
  it("builds today's production, where no Stripe var exists, and says Stripe is off", () => {
    const { status, out } = run({ ...PRODUCTION, ...CORE, ...ORIGINS });
    expect(status).toBe(0);
    expect(out).toContain('Stripe is off here');
  });

  it('still builds production without the allow-list while Stripe is off, but says what it breaks', () => {
    const { status, out } = run({ ...PRODUCTION, ...CORE });
    expect(status).toBe(0);
    expect(out).toMatch(/BANKING_ALLOWED_ORIGINS is unset .*400 Invalid redirect URLs/);
  });

  it.each([
    ['live', 'sk_live_partial'],
    ['test', 'sk_test_partial']
  ])('fails a production build holding a %s key and nothing else, naming every gap', (mode, key) => {
    const { status, out } = run({ ...PRODUCTION, ...CORE, STRIPE_SECRET_KEY: key });
    expect(status).toBe(1);
    expect(out).toContain(`(${mode} key)`);
    for (const gap of [
      'STRIPE_WEBHOOK_SECRET is unset',
      'STRIPE_PRICE_PREMIUM_MONTHLY is unset',
      'STRIPE_PRICE_PRO_MONTHLY is unset',
      'BANKING_ALLOWED_ORIGINS is unset'
    ]) {
      expect(out).toContain(gap);
    }
  });

  it('builds production when the whole go-live set is there and well-formed', () => {
    const { status, out } = run({ ...PRODUCTION, ...CORE, ...STRIPE_LIVE });
    expect(status).toBe(0);
    expect(out).not.toMatch(/Stripe/);
  });

  it('catches the product id pasted where the price id belongs', () => {
    const { status, out } = run({ ...PRODUCTION, ...CORE, ...STRIPE_LIVE, STRIPE_PRICE_PRO_MONTHLY: 'prod_pro' });
    expect(status).toBe(1);
    expect(out).toContain('STRIPE_PRICE_PRO_MONTHLY does not start with price_');
  });

  it.each([
    'https://www.reckley.co.uk/',
    'https://www.reckley.co.uk/subscription',
    'http://www.reckley.co.uk',
    'https://WWW.reckley.co.uk',
    'https://www.reckley.co.uk:443',
    'www.reckley.co.uk'
  ])('fails production on an allow-list entry that can never equal an Origin header: %s', (entry) => {
    const { status, out } = run({
      ...PRODUCTION,
      ...CORE,
      ...STRIPE_LIVE,
      BANKING_ALLOWED_ORIGINS: `https://www.wealthtrackerpro.co.uk,${entry}`
    });
    expect(status).toBe(1);
    expect(out).toContain(JSON.stringify(entry));
  });

  it('never prints a Stripe value, passing or failing', () => {
    const passing = run({ ...PRODUCTION, ...CORE, ...STRIPE_LIVE });
    const failing = run({ ...PRODUCTION, ...CORE, STRIPE_SECRET_KEY: SECRET, STRIPE_WEBHOOK_SECRET: 'not-a-whsec' });
    expect(failing.status).toBe(1);
    for (const { out } of [passing, failing]) {
      expect(out).not.toContain('FAKEsecretVALUE');
      expect(out).not.toContain('FAKEwebhookVALUE');
      expect(out).not.toContain('not-a-whsec');
    }
  });
});

describe('server-env preflight: everywhere else reports and builds', () => {
  it('builds a preview with half a Stripe, warning about each gap', () => {
    const { status, out } = run({ ...PREVIEW, STRIPE_SECRET_KEY: 'sk_test_partial' });
    expect(status).toBe(0);
    expect(out).toContain('STRIPE_WEBHOOK_SECRET is unset');
  });

  it('warns when a preview carries a LIVE key — a preview that can take real money', () => {
    const { status, out } = run({ ...PREVIEW, ...STRIPE_LIVE });
    expect(status).toBe(0);
    expect(out).toContain('can take real money');
  });

  it('never fails outside Vercel', () => {
    expect(run({ STRIPE_SECRET_KEY: 'sk_live_partial' }).status).toBe(0);
  });

  it('still fails a production build missing a core secret', () => {
    const { status, out } = run({ ...PRODUCTION, ...ORIGINS });
    expect(status).toBe(1);
    expect(out).toContain('Missing REQUIRED server env in production build');
  });
});

describe('server-env preflight: no Stripe secret under a VITE_ name', () => {
  it.each(['VITE_STRIPE_SECRET_KEY', 'VITE_STRIPE_WEBHOOK_SECRET', 'VITE_SUPABASE_SERVICE_ROLE_KEY'])(
    'refuses %s on any Vercel build',
    (name) => {
      const { status, out } = run({ ...PREVIEW, [name]: 'anything' });
      expect(status).toBe(1);
      expect(out).toContain(`FORBIDDEN env var(s) set: ${name}`);
    }
  );

  it('refuses a Stripe secret under any VITE_ name, naming the var and not the value', () => {
    const { status, out } = run({ ...PREVIEW, VITE_PAYMENTS_KEY: SECRET });
    expect(status).toBe(1);
    expect(out).toContain('VITE_PAYMENTS_KEY');
    expect(out).not.toContain('FAKEsecretVALUE');
  });

  it('lets a publishable key through — it is public by design', () => {
    expect(run({ ...PREVIEW, VITE_STRIPE_PUBLISHABLE_KEY: 'pk_live_public' }).status).toBe(0);
  });
});
