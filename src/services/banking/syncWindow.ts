/**
 * How far back a sync may ask, and why it is not always ninety days.
 *
 * A bank may serve ninety days of history to an unattended job. Anything
 * OLDER — and at some providers the ninetieth day itself — is a "protected
 * resource" readable only within about five minutes of the customer
 * authenticating. That is Strong Customer Authentication under PSD2:
 * regulation, not a provider's preference.
 *
 * The sync used to ask for the full ninety days on EVERY run. Lenient
 * providers served it. A strict one refused with
 *
 *     ...expired. This resource is protected and should be accessed
 *     within 5 minutes...
 *
 * which the app then classified — reasonably, on the words available — as
 * "this connection needs reauthorizing". So the owner reauthorized, the sync
 * inside the next five minutes worked, and every sync after it failed again.
 * A daily ritual caused entirely by asking for something the app had no fresh
 * authentication to read. The connection was never broken.
 *
 * Hence: the window depends on whether authentication is fresh.
 */

/** The long window, lawful only while authentication is fresh. */
export const FIRST_SYNC_WINDOW_DAYS = 90;

/**
 * How far back a ROUTINE sync re-reads behind its last success.
 *
 * Not zero: a card transaction can settle days after it is made, and a bank
 * can backdate a row after the fact. Re-reading a week and letting dedup
 * discard the repeats is far cheaper than missing them.
 */
export const ROUTINE_SYNC_OVERLAP_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The earliest instant this sync may ask for.
 *
 * @param lastSync when the connection last synced successfully, or null/absent
 *   if it never has — the moments just after linking, when SCA is fresh and
 *   the provider will serve history. That is the one chance to collect it.
 * @param now the clock, passed in so this is testable and never surprises.
 */
export function syncWindowStart(lastSync: string | null | undefined, now: Date): Date {
  const longWindowStart = now.getTime() - FIRST_SYNC_WINDOW_DAYS * DAY_MS;

  const lastSyncedAt = typeof lastSync === 'string' ? new Date(lastSync) : null;
  if (lastSyncedAt === null || Number.isNaN(lastSyncedAt.getTime())) {
    // Never synced — or a stored value nobody can read, which is treated the
    // same way rather than being guessed at.
    return new Date(longWindowStart);
  }

  // Never reach further back than the long window even so: a connection that
  // has not run for a year must not quietly turn a routine sync into a
  // protected-resource request and start the whole cycle again.
  return new Date(Math.max(lastSyncedAt.getTime() - ROUTINE_SYNC_OVERLAP_DAYS * DAY_MS, longWindowStart));
}
