/**
 * Every external origin the app fetches must be allowed by BOTH content
 * security policies — the header vercel.json sends, and the meta tag
 * src/security/csp.ts injects in production. A browser enforces the
 * INTERSECTION of every policy in force, so an origin missing from either
 * one is blocked.
 *
 * Why this exists: the historical-rates service (api.frankfurter.dev,
 * PR #386) shipped without touching either policy. Dev servers send no CSP,
 * so every local and pane verification passed — while production blocked the
 * fetch and pinned every real user in the degraded unit-for-unit state. Three
 * converted reports spent weeks telling readers they were unconverted
 * (Design review, 23 Aug §1). The failure mode is total silence everywhere
 * except a production console, which is exactly what a test must cover.
 *
 * When a NEW external fetch ships, add its origin to ORIGINS_THE_CODE_FETCHES
 * (importing the module's own constant where one exists), and to both
 * policies. This spec fails by name on whichever policy was forgotten.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getCSPDirectives } from '../csp';
import { PROVIDER_ORIGIN as HISTORICAL_RATES_ORIGIN } from '../../services/historicalRatesService';

const ORIGINS_THE_CODE_FETCHES: ReadonlyArray<{ origin: string; fetchedBy: string }> = [
  {
    // Imported from the service so a provider swap fails here by name.
    origin: HISTORICAL_RATES_ORIGIN,
    fetchedBy: 'src/services/historicalRatesService.ts (backdated ECB rates)',
  },
  {
    // Hardcoded in the fetch call — src/utils/currency.ts:95 and
    // currency-decimal.ts. If the display-rates provider moves, this line
    // and both policies move with it.
    origin: 'https://api.exchangerate-api.com',
    fetchedBy: "src/utils/currency.ts (today's display rates)",
  },
];

/** One directive from the vercel.json header production actually sends. */
function vercelDirective(name: 'connect-src' | 'script-src'): string {
  const raw = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');
  const config = JSON.parse(raw) as {
    headers?: Array<{ headers?: Array<{ key: string; value: string }> }>;
  };
  const csp = (config.headers ?? [])
    .flatMap(entry => entry.headers ?? [])
    .find(header => header.key === 'Content-Security-Policy');
  if (!csp) throw new Error('vercel.json no longer carries a Content-Security-Policy header');
  const directive = csp.value
    .split(';')
    .map(entry => entry.trim())
    .find(entry => entry.startsWith(`${name} `));
  if (!directive) throw new Error(`vercel.json's CSP no longer has a ${name} directive`);
  return directive;
}

/** The connect-src list from the vercel.json header production actually sends. */
const vercelConnectSrc = (): string => vercelDirective('connect-src');

describe('every fetched origin is allowed by both content security policies', () => {
  const metaConnectSrc = getCSPDirectives()['connect-src'] ?? [];
  const headerConnectSrc = vercelConnectSrc();

  for (const { origin, fetchedBy } of ORIGINS_THE_CODE_FETCHES) {
    it(`${origin} — the vercel.json header allows what ${fetchedBy} fetches`, () => {
      expect(headerConnectSrc).toContain(origin);
    });

    it(`${origin} — the production meta-tag policy (src/security/csp.ts) allows it too`, () => {
      expect(metaConnectSrc).toContain(origin);
    });
  }
});

/**
 * The production Clerk frontend API — where clerk-js is loaded from and every
 * auth call goes. It is a subdomain of the app's own domain, so no wildcard in
 * either policy covers it, and losing it from either kills sign-in in
 * production only (dev servers send no CSP).
 *
 * TWO hosts while the rename's domain move is in flight (phase 6): the
 * publishable key names exactly one, and which one changes on the day Clerk's
 * production domain moves to reckley.co.uk. Retire the old host here and from
 * both policies only after that day, never before it.
 */
const CLERK_FRONTEND_HOSTS = ['https://clerk.wealthtrackerpro.co.uk', 'https://clerk.reckley.co.uk'] as const;

describe('both policies admit the Clerk frontend API, at either address, for the length of the move', () => {
  const meta = getCSPDirectives();
  const headerConnectSrc = vercelConnectSrc();
  const headerScriptSrc = vercelDirective('script-src');

  for (const host of CLERK_FRONTEND_HOSTS) {
    it(`${host} — the vercel.json header lets the app call it and load clerk-js from it`, () => {
      expect(headerConnectSrc.split(' ')).toContain(host);
      expect(headerScriptSrc.split(' ')).toContain(host);
    });

    it(`${host} — the production meta-tag policy lets the app call it and load clerk-js from it`, () => {
      expect(meta['connect-src']).toContain(host);
      // The meta policy admits scripts from any https origin; it must keep
      // doing so, or name the host.
      const scriptSrc = meta['script-src'] ?? [];
      expect(scriptSrc.includes(host) || scriptSrc.includes('https:')).toBe(true);
    });
  }
});
