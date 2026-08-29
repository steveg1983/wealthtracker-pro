import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * THE SCOPES ARE THE PROMISE.
 *
 * The landing page says a bank connection "cannot move money, and there is no
 * code here that could". That is true of today's tree — every TrueLayer call
 * is a read against /data/v1/* — but a sentence on a marketing page deserves
 * better than a code-review guarantee. This test makes it self-defending: the
 * moment anyone adds a payments scope, or any scope at all, the suite names
 * the sentence that just became a lie.
 *
 * Read as source rather than imported: the module reaches for server env at
 * load, and what is under test is the literal list, not behaviour.
 */
describe('the bank connection is read-only by construction', () => {
  const source = readFileSync(
    resolve(__dirname, '../../api/banking/create-link-token.ts'),
    'utf8'
  );

  it('requests exactly the six read scopes, and nothing that could move money', () => {
    const match = source.match(/const AUTH_SCOPES = \[([^\]]*)\]/);
    expect(match).not.toBeNull();
    const scopes = match![1]
      .split(',')
      .map(s => s.trim().replace(/['"]/g, ''))
      .filter(Boolean)
      .sort();
    expect(scopes).toEqual(
      ['accounts', 'balance', 'cards', 'info', 'offline_access', 'transactions'].sort()
    );
  });

  it('never enables the credential-sharing provider class', () => {
    // The auth URL builder turns on Open Banking and OAuth providers only.
    // enable_credentials_sharing_providers is the flag under which a bank
    // password could reach a screen-scraper; its absence is load-bearing for
    // "your banking credentials never pass through this app".
    const trueLayer = readFileSync(
      resolve(__dirname, '../../api/_lib/truelayer.ts'),
      'utf8'
    );
    expect(trueLayer).not.toContain('enable_credentials_sharing_providers');
  });
});
