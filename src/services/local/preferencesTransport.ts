/**
 * Where a device's settings live: in the ledger file, beside the money.
 *
 * The third implementation of {@link PreferencesTransport}. The cloud's is a
 * `user_preferences` row over PostgREST; the browser's is the service's own
 * mirror (`localBackupService`'s `LocalPreferencesPort`, which reads and writes
 * the in-memory document and lets `window.localStorage` be the store). This one
 * is two verbs over {@link CoreTransport}, so the choices a person makes about
 * how to READ their ledger are stored in the same file as the ledger.
 *
 * ── WHY THAT MATTERS ENOUGH TO BE A SLICE ───────────────────────────────────
 *
 * `preferencesService.ts` opens with the reason this tier exists at all: a full
 * backup was restored into a fresh login and the app came up factory-reset —
 * right accounts, right transactions, and every choice about how to look at them
 * gone. On a device the same failure has a different shape and is worse, because
 * there is no account to fall back on: settings would live in the WebView's
 * `localStorage`, which is not in the backup, does not move with the file, and
 * is thrown away by anything that clears the app's data. Somebody could copy
 * their ledger to a new machine, open it, and find their dashboard empty.
 *
 * A file that holds the money and not the choices is a file that is only half a
 * backup.
 *
 * ── IT HAS NO SUPABASE IN ITS SCOPE, AND THAT IS CHECKED ────────────────────
 *
 * This module is reachable from `deviceDocument.ts`, which is where
 * `deviceDocument.cloudFree.test.ts` starts its walk of the import graph. Hence
 * `PreferencesTransport` and `PreferencesDocument` come from
 * `services/preferences/document.ts` rather than from `preferencesService.ts`,
 * which reaches a Supabase client and the app's cloud-bound logger on its first
 * two lines. The import would be erased at build and would still be wrong — see
 * `localDataPort.ts` on the backup format, which makes the same decision for the
 * same reason.
 *
 * ── SEAM RULE 1, AND THE ARGUMENT THIS INTERFACE STILL TAKES ────────────────
 *
 * `DataPort`'s first rule is that no operation takes a user id and every
 * implementation resolves its own owner. `PreferencesTransport` is not that
 * seam: its two verbs take one, because the cloud's store is a table keyed by
 * it. A file's is not — it holds ONE owner, resolved when the document was
 * opened (PHASE3-PLAN D-5) — so the argument arrives here with nothing to do.
 *
 * It is CHECKED rather than ignored, and that is the whole of the isolation
 * story on this engine. A file can legitimately hold a second login's rows (a
 * restored backup from an account that had two), and there is no RLS to narrow
 * an answer afterwards. Ignoring the argument would make a mismatch invisible;
 * passing it through would make it silent in a worse way, because
 * `read_preferences` for a login the file does not hold answers `null` — which
 * `PreferencesService.attach` reads as *"no settings yet"* and answers with THE
 * LIFT, writing this window's document into the file under somebody else's id.
 * The foreign key would then refuse the write, at a moment nobody is watching,
 * and the person's settings would silently stop being saved.
 *
 * So a mismatch is a REFUSAL, by name, with both ids in it.
 */

import type { CoreTransport } from './coreTransport';
import { field, rowOf } from './mappers/values';
import {
  parsePreferencesDocument,
  type PreferencesDocument,
  type PreferencesTransport
} from '../preferences/document';

/** What one open document needs to answer the preferences seam. */
export interface LocalPreferencesOptions {
  /** The uuid in the file's one `users` row. See `deviceIdentity.ts`. */
  readonly owner: string;
  /** How this document is reached. The SAME transport the port uses. */
  readonly transport: CoreTransport;
}

/**
 * The `answer.preferences` a verb hands back: a document, or `null`.
 *
 * Read through the port's own `rowOf`, so a verb that answered the wrong shape
 * is the same FAULT here as it is for every other answer in this edition. That
 * matters more here than most: a reader that shrugged would report a broken
 * transport as *"this person has no settings"*, which is the one wrong answer
 * that causes damage — it is what triggers the lift.
 */
const documentIn = (result: unknown, verb: string): PreferencesDocument | null => {
  const stored = field(rowOf(result, verb, 'answer'), 'preferences');
  // `null` is the file's own word for "none here", and it is NOT an empty
  // document: the difference is what `attach` branches on. `undefined` is the
  // key missing altogether, which is a different failure and is named as one
  // rather than folded into the null case.
  if (stored === null) return null;
  if (stored === undefined) {
    throw new Error(`The ledger file did not say whether ${verb} found a document.`);
  }
  // Parsed by the app's own reader, never trusted as it arrives: a `values`
  // entry that is not a string is dropped, an unrecognised `version` is kept.
  // The crate stores the document opaquely and deliberately checks none of that.
  return parsePreferencesDocument(stored);
};

/**
 * The settings of the one ledger this window has open.
 *
 * Constructed with the document's owner and its transport, exactly as
 * `LocalDataPort` is and for the same reason: an owner resolved once at open,
 * and nowhere to pass a different one per call.
 */
export const localPreferencesTransport = (
  options: LocalPreferencesOptions
): PreferencesTransport => {
  const { owner, transport } = options;

  /**
   * The check described in the header. It reads as paranoia and it is the only
   * thing between a second login's settings and this file.
   */
  const mine = (userId: string): void => {
    if (userId === owner) return;
    throw new Error(
      `These settings belong to ${userId}, and this ledger is ${owner}'s. Nothing was read or ` +
        'written. Open the ledger that belongs to this login, or restore a backup into a new one.'
    );
  };

  return {
    async read(userId: string): Promise<PreferencesDocument | null> {
      mine(userId);
      const result = await transport.call('read_preferences', { user_id: owner });
      return documentIn(result, 'read_preferences');
    },

    async write(userId: string, document: PreferencesDocument): Promise<void> {
      mine(userId);
      // The verb answers with the document as STORED and this discards it, for
      // `closeAccount`'s reason in `localDataPort.ts`: the seam's `write`
      // returns `void`, and a return value nobody reads is a return value that
      // will one day be read wrongly. The read-back is not wasted — it is what
      // makes the round trip provable from the crate's own tests and from the
      // differential harness, where two engines are compared on what each file
      // now holds rather than on what each was sent.
      await transport.call('write_preferences', { user_id: owner, preferences: document });
    }
  };
};
