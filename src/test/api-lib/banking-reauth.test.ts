import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A FEED THAT TELLS YOU WHEN IT STOPS.
 *
 * Observed live 29–30 Aug 2026: all three of the owner's connections failed
 * every sync for three days — stored tokens that could no longer be
 * decrypted threw raw crypto TypeErrors, which no classifier recognised, so
 * the connections went on claiming 'connected', nothing showed in the app,
 * and Sentry emailed once per throw. Two rules close it:
 *
 *  1. An unreadable stored credential IS a reauth fact — decrypt failures
 *     become ReauthRequiredError, which the handlers' classifier already
 *     turns into status='reauth_required' and the Reconnect CTA.
 *  2. An already-marked connection is refused EARLY — before any provider
 *     call, any Sentry capture, any history spam. One email at the
 *     transition; silence after, until the owner reconnects.
 *
 * Every key and token here invented: this repo is public.
 */

// Set before the first call: `encryption.ts` reads ENCRYPTION_KEY lazily and
// caches — the same pattern banking-consent.test.ts uses.
process.env.ENCRYPTION_KEY = 'invented-test-key-0123456789abcdef';

import { withProviderAccessToken, ReauthRequiredError } from '../../../api/_lib/banking-sync';
import { encryptSecret } from '../../../api/_lib/encryption';
import type { BankConnectionRow } from '../../../api/_lib/banking-sync';

const connectionWith = (overrides: Partial<BankConnectionRow>): BankConnectionRow => ({
  id: 'conn-1',
  user_id: 'user-1',
  provider: 'truelayer',
  institution_id: 'inst-1',
  institution_name: 'Synthetic Bank',
  access_token_encrypted: encryptSecret('synthetic-access-token'),
  refresh_token_encrypted: encryptSecret('synthetic-refresh-token'),
  ...overrides,
});

// withProviderAccessToken only touches supabase on the refresh path. The
// double is a REAL client whose transport refuses — no casts, and any
// network touch fails loudly with its own sentence.
import { createClient } from '@supabase/supabase-js';
const supabaseNeverReached = createClient('http://localhost:54321', 'invented-anon-key', {
  global: {
    fetch: () => {
      throw new Error('supabase must not be touched before decryption succeeds');
    },
  },
});

describe('an unreadable stored credential is a reauth fact, not a crash', () => {
  it('a garbage access token throws ReauthRequiredError, never the crypto error', async () => {
    const connection = connectionWith({
      // Too short to hold even the IV — the exact shape of the 29 Aug
      // Sentry error ("Invalid authentication tag length: 6").
      access_token_encrypted: Buffer.from('truncated-blob').toString('base64'),
    });
    const operation = vi.fn();
    await expect(
      withProviderAccessToken(supabaseNeverReached, connection, operation)
    ).rejects.toThrow(ReauthRequiredError);
    expect(operation).not.toHaveBeenCalled();
  });

  it('the reauth message names the remedy and never echoes cipher internals', async () => {
    const connection = connectionWith({
      access_token_encrypted: Buffer.from('truncated-blob').toString('base64'),
    });
    await expect(
      withProviderAccessToken(supabaseNeverReached, connection, vi.fn())
    ).rejects.toThrow(/stored access token can no longer be read — reconnect the bank/);
  });

  it('a healthy token still reaches the operation untouched', async () => {
    const connection = connectionWith({});
    const operation = vi.fn(async (token: string) => token);
    const result = await withProviderAccessToken(supabaseNeverReached, connection, operation);
    expect(result).toBe('synthetic-access-token');
  });
});

describe('an already-marked connection is refused before any work', () => {
  /**
   * The guard lives in each handler between loading the connection and the
   * first provider call. Source-read, the house pattern for api/ behaviour
   * the jsdom suite cannot execute (serverlessImportClosure precedent): the
   * pin is that BOTH handlers refuse with the same 409 the transition gave,
   * and that the refusal sits BEFORE withProviderAccessToken.
   */
  const handlers = ['api/banking/sync-accounts.ts', 'api/banking/sync-transactions.ts'];

  it.each(handlers)('%s refuses reauth_required connections before the provider', (handler) => {
    const source = readFileSync(resolve(__dirname, '../../../', handler), 'utf8');
    const guardAt = source.indexOf("connection.needs_reauth || connection.status === 'reauth_required'");
    // The CALL, not the import at the top of the file.
    const providerAt = source.indexOf('await withProviderAccessToken(');
    expect(guardAt).toBeGreaterThan(-1);
    expect(providerAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(providerAt);
    // The refusal speaks the transition's own words, so the client has one path.
    expect(source.slice(guardAt, guardAt + 400)).toContain("'reauth_required'");
  });
});
