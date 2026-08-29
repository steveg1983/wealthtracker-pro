import { decryptSecret } from './encryption.js';
import { revokeAccessToken } from './truelayer.js';

/**
 * GIVING THE BANK ITS CONSENT BACK.
 *
 * ─ WHY THIS IS ITS OWN MODULE ───────────────────────────────────────────────
 *
 * Deleting a `bank_connections` row and revoking the consent behind it are two
 * different acts, and for a while the app only performed the first. That was
 * fixed once, in `api/banking/disconnect.ts`, and the fix stayed there — so
 * "Disconnect" revoked and "Delete my account" did not. Somebody exercising
 * their right to erasure had every trace removed from us and left TrueLayer
 * holding a live authorisation for their bank, which is the one place erasure
 * most obviously has to reach.
 *
 * The revocation lives here rather than in either handler so there is ONE
 * description of what revoking means, and adding a third caller cannot
 * reintroduce the gap by forgetting to copy it.
 *
 * ─ BEST EFFORT, DELIBERATELY ────────────────────────────────────────────────
 *
 * Nothing here throws. Both callers delete regardless of the answer, and for
 * the same reason in both cases: the user has asked to leave, and a connection
 * left standing is what recreates their accounts on the next sync. A provider
 * that is down must not be able to trap somebody in a bank feed — nor to block
 * a GDPR erasure.
 *
 * What the callers must NOT do is pass the silence off as success. The boolean
 * is the whole point: it is how a caller tells a full disconnection from a
 * local one, and it is what reaches the user as "your bank may still hold this
 * authorisation".
 */

/** The columns a revocation needs off a `bank_connections` row. */
export interface RevocableConnection {
  id: string;
  provider: string | null;
  access_token_encrypted: string | null;
}

/**
 * Revoke one connection's consent at its provider. Never throws.
 *
 * `false` means "we did not get a confirmed revocation", which deliberately
 * covers three cases at once — the provider refused, the provider was
 * unreachable, and there was nothing revocable to begin with (a row with no
 * token, or one belonging to a provider we have no revocation call for). A
 * caller cannot honestly claim the consent is gone in any of them, and that is
 * the only distinction the callers act on.
 */
export const revokeConnectionConsent = async (
  connection: RevocableConnection
): Promise<boolean> => {
  if (connection.provider !== 'truelayer' || !connection.access_token_encrypted) {
    return false;
  }

  try {
    return await revokeAccessToken(decryptSecret(connection.access_token_encrypted));
  } catch {
    // Includes a token this deployment's ENCRYPTION_KEY can no longer decrypt.
    // Unrevocable is unrevocable; it is not a reason to keep the row.
    return false;
  }
};

/**
 * Revoke a whole list, and report the ids that did not confirm.
 *
 * Every connection is attempted even after one fails: one bank refusing must
 * not leave the rest of somebody's consents standing. Sequential rather than
 * parallel because these are outbound calls made during a delete, and a person
 * has a handful of banks, not a thousand.
 */
export const revokeConnectionConsents = async (
  connections: readonly RevocableConnection[]
): Promise<string[]> => {
  const unrevoked: string[] = [];
  for (const connection of connections) {
    if (!(await revokeConnectionConsent(connection))) {
      unrevoked.push(connection.id);
    }
  }
  return unrevoked;
};
