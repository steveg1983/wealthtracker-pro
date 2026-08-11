/**
 * Who you are, on a device: the uuid in the open file's one `users` row.
 *
 * ── THE QUESTION THIS ANSWERS, AND WHY IT NEEDED A MODULE ───────────────────
 *
 * PHASE3-PLAN D-5 settles the identity of a LEDGER — *"the owner of a local file
 * is a uuid minted when the FILE is created, stored in its one `users` row"* —
 * and slices 18 and 27 built both ends of it: `LocalDataPort` is constructed
 * with an owner and puts it on every verb, and the shell's `create_ledger`
 * mints one while `open_ledger` reads it back.
 *
 * Between those two there was nothing, and the gap is not the port's to fill.
 * The port CACHES the owner and never hands it out: `#owner` is private, which
 * is exactly right (seam rule 1 — no operation takes a user id, so no caller
 * needs to know one to ask a question). But the layer ABOVE the seam does have
 * one caller that needs an identity rather than an answer, and this slice added
 * a second:
 *
 *   * the PREFERENCES service, which is keyed by user and whose document a file
 *     now holds (`preferencesTransport.ts`). `attach(userId)` is the seam, and
 *     the device's answer to it is the file's owner;
 *   * everything the app currently asks `userIdService` for. That module is the
 *     Clerk↔database translator and it reaches a Supabase client on its first
 *     line — a device has neither half of the translation and cannot import it.
 *
 * ── WHAT IT IS NOT: A SECOND `userIdService` ────────────────────────────────
 *
 * There is nothing to translate. `userIdService`'s whole job is a mapping —
 * `"user_2abc…"` → a uuid — kept in a cache with an expiry because it is an
 * answer from a network. A device has ONE id, it is in the file, it was read
 * when the file was opened, and it cannot change while the file is open. So this
 * is a value with a lifetime, not a service with a cache, and the difference is
 * worth keeping: a device identity that could be refreshed would be a device
 * identity that could be refreshed to something else.
 *
 * ── WHY A MODULE-SCOPE VALUE RATHER THAN AN ARGUMENT ────────────────────────
 *
 * Because the callers are the ones an argument cannot reach: `useState`
 * initialisers, hooks and pages scattered across the app, mounting at different
 * times — which is the same reason `preferences` is a singleton and the same
 * reason `userIdService` is one. It is set in ONE place (`openDeviceDocument`,
 * which is where a device document is assembled) and cleared in one
 * ({@link forgetDeviceIdentity}, which is what closing a ledger means up here).
 *
 * It is deliberately NOT reactive. Nothing subscribes, because the identity
 * cannot change under a mounted tree: opening a different ledger replaces the
 * document, and the app is booted against it (`bootDeviceLedger`). A subscribe
 * here would be machinery for an event that would be a bug.
 */

/** An open ledger, as the app above the seam needs to see it. */
export interface DeviceIdentity {
  /** The uuid in the file's one `users` row. Every verb is asked in this name. */
  readonly owner: string;
  /** Where the file is. For the window title and the "which ledger?" question. */
  readonly path: string;
}

/**
 * `users.id` must be a lowercase 36-character uuid — `schema.sql`'s CHECK.
 *
 * The same expression `localDataPort.ts` holds, and deliberately a second copy
 * rather than an import: the port refuses a bad owner so that R-3 fails at
 * CONSTRUCTION instead of as a foreign-key violation on the first write, and
 * this refuses one so that the app above never publishes an identity the engine
 * below would not accept. Sharing the constant would couple the two refusals
 * into one, and the whole value of having both is that either can fail alone.
 */
const OWNER_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let current: DeviceIdentity | null = null;

/**
 * Remember whose ledger is open.
 *
 * Called by `openDeviceDocument` AFTER the port has been constructed, which is
 * the order that matters: the port refuses an owner that is not a uuid, so a
 * malformed one never reaches this module and the app is never told an identity
 * the engine below has already rejected. The check here is therefore a second
 * gate rather than the first, and it exists for the caller that is not
 * `openDeviceDocument` — there is not one today, and this is what makes adding
 * one safe.
 */
export const adoptDeviceIdentity = (identity: DeviceIdentity): void => {
  if (!OWNER_SHAPE.test(identity.owner)) {
    throw new Error(
      `A local ledger is owned by the uuid in its own users row, and ${JSON.stringify(
        identity.owner
      )} is not one. Nothing has been opened.`
    );
  }
  current = identity;
};

/** Whose ledger is open, or `null` when none is. */
export const currentDeviceIdentity = (): DeviceIdentity | null => current;

/**
 * The open ledger's owner, or a sentence saying there is not one.
 *
 * For the callers that cannot carry on without an answer — the preferences
 * attach is the first — and it THROWS rather than answering a placeholder for
 * the reason the whole slice exists: an identity that is quietly wrong is
 * settings written under somebody else's name, or a ledger read as empty. A
 * caller that can carry on uses {@link currentDeviceIdentity} and says what it
 * does with `null`.
 *
 * @throws when no ledger is open in this window.
 */
export const requireDeviceOwner = (): string => {
  if (current === null) {
    throw new Error(
      'No ledger is open in this window, so there is nobody for this to belong to. Open or ' +
        'create a ledger first.'
    );
  }
  return current.owner;
};

/**
 * Forget it — what `close_ledger` means to the layer above the seam.
 *
 * Also what a test calls between cases: this is module state, and a suite that
 * left one case's identity standing would be a suite in which the next case's
 * "who am I" question was answered by the previous case.
 */
export const forgetDeviceIdentity = (): void => {
  current = null;
};
