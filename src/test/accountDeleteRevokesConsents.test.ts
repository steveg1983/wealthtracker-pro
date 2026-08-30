import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * "DELETE MY ACCOUNT" HAS TO REACH THE BANK TOO.
 *
 * `api/account/delete.ts` deletes the `users` row, and every bank connection
 * goes with it by ON DELETE CASCADE. For a long time that was the whole of it:
 * somebody exercising their right to erasure had every trace of themselves
 * removed from us and left TrueLayer holding a live authorisation for their
 * bank account. The in-app "Delete All Data" already revoked — it goes through
 * /api/banking/disconnect — so the path that erased MORE revoked LESS.
 *
 * The behaviour of the revocation itself is pinned properly, against the real
 * encryption and the real TrueLayer call, in
 * `src/test/api-lib/banking-consent.test.ts`. What that cannot see is the one
 * thing this handler can get wrong on its own: ORDER. The access token lives
 * IN the row the cascade removes, so a revocation attempted after the delete
 * has nothing left to revoke with — and it would fail silently, because the
 * revocation is best-effort by design.
 *
 * vitest excludes api/** (see vitest.config.ts), and this handler reaches for
 * Clerk, Stripe, Supabase and a rate limiter at module scope, so there is no
 * honest way to execute it here. Reading the source is the house answer to
 * that (serverlessImportClosure.test.ts, feedImportLatestDefinition.test.ts) —
 * narrow, but it fails loudly the day somebody moves the revocation below the
 * delete, which is the failure that would otherwise never be noticed.
 */

const HANDLER = path.resolve(__dirname, '../../api/account/delete.ts');
const source = readFileSync(HANDLER, 'utf8');

/** Where the users row — and with it every bank connection — is destroyed. */
const userRowDeletion = source.search(/\.from\('users'\)\s*\.delete\(\)/);

describe('account deletion and the consents it is standing on', () => {
  it('revokes through the shared helper rather than a second copy of it', () => {
    // One description of what revoking means, so a third caller cannot
    // reintroduce the gap by forgetting to copy it. The helper is also why
    // this handler no longer needs `revokeAccessToken` or `decryptSecret` of
    // its own — a private copy here would be the regression, not a detail.
    expect(source).toContain("from '../_lib/banking-consent.js'");
    expect(source).toContain('revokeConnectionConsents');
    expect(source).not.toContain('revokeAccessToken');
  });

  it('reads the connections and revokes them BEFORE the cascade', () => {
    const connectionsRead = source.indexOf("from('bank_connections')");
    const revocation = source.indexOf('await revokeConnectionConsents(');

    expect(connectionsRead).toBeGreaterThan(-1);
    expect(revocation).toBeGreaterThan(-1);
    expect(userRowDeletion).toBeGreaterThan(-1);

    // The token is a column on the row. Read it, spend it, then delete.
    expect(connectionsRead).toBeLessThan(revocation);
    expect(revocation).toBeLessThan(userRowDeletion);
  });

  it('reads the column the revocation actually needs', () => {
    // A select that omitted the encrypted token would revoke nothing and
    // report it as "no connections could be confirmed" — indistinguishable,
    // from the outside, from a provider being down.
    expect(source).toContain('access_token_encrypted');
  });

  it('does not make the erasure conditional on the provider answering', () => {
    // Refusing to delete somebody's data because a third party would not
    // reply is the worse failure of the two, and nothing about the obligation
    // to erase is conditional on TrueLayer's cooperation. An unconfirmed
    // revocation is recorded and the deletion carries on.
    const revocation = source.indexOf('await revokeConnectionConsents(');
    const betweenRevokeAndDelete = source.slice(revocation, userRowDeletion);
    expect(betweenRevokeAndDelete).toContain('warnings.push');
    expect(betweenRevokeAndDelete).not.toContain('return res.status');
  });
});
