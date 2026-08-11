/**
 * The preferences DOCUMENT — its shape, its parser, and the keys inside it that
 * name rows.
 *
 * ── WHY THIS IS A MODULE OF ITS OWN ─────────────────────────────────────────
 *
 * `preferencesService.ts` is where preferences LIVE while the app runs: a
 * Supabase transport, a debounced writer, a local mirror, a class with a cache.
 * Its module scope reaches `supabase` and the app's cloud-bound logger on its
 * first two lines.
 *
 * What is here is none of that. It is the FILE FORMAT half — what a preferences
 * document IS, how to read one off the wire without trusting it, and which of
 * its keys hold ids that a restore has to follow. Those are statements about a
 * document on somebody's disk rather than about an engine, and a backup file
 * carries the document verbatim: `buildBackupBundle` puts it in, `remapBackupIds`
 * rewrites the ids inside it, and a restore puts it back.
 *
 * It was lifted out in slice 27, when the desktop shell became the first caller
 * that has a preferences document to remap and no Supabase client to reach for.
 * The chain it had to break is one import long and entirely invisible from
 * either end: `services/backup/format.ts` needs `PREFERENCE_KEYS_HOLDING_IDS`,
 * and taking it from `preferencesService.ts` would have put the cloud in a
 * desktop bundle through a constant that is a list of strings.
 *
 * `preferencesService.ts` re-exports every name below, so nothing that already
 * imported one of them changed.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The version this build writes.
 *
 * Bump it only when the MEANING of the values map changes, never for a new key
 * — new keys are the normal case and need no version at all. A document
 * claiming a version this build does not know is read anyway, values and all:
 * refusing it would lose every setting rather than the one that changed.
 */
export const PREFERENCES_DOCUMENT_VERSION = 1;

export interface PreferencesDocument {
  version: number;
  /** Preference key → the exact string the call site stored. */
  values: Record<string, string>;
}

export const EMPTY_PREFERENCES: PreferencesDocument = { version: PREFERENCES_DOCUMENT_VERSION, values: {} };

/**
 * Read a document off the wire.
 *
 * Deliberately forgiving in one direction and strict in the other: a `values`
 * entry that is not a string is DROPPED (nothing can consume it, and keeping it
 * would put a shape into the document that a later write would echo back to the
 * database), while an unrecognised VERSION is kept as it is. The first is
 * corruption; the second is a newer client, and a newer client's document must
 * come back out of an older one unharmed.
 */
export function parsePreferencesDocument(raw: unknown): PreferencesDocument {
  if (!isRecord(raw)) return { ...EMPTY_PREFERENCES, values: {} };

  const version = typeof raw.version === 'number' && Number.isFinite(raw.version)
    ? raw.version
    : PREFERENCES_DOCUMENT_VERSION;

  const values: Record<string, string> = {};
  if (isRecord(raw.values)) {
    for (const [key, value] of Object.entries(raw.values)) {
      if (typeof value === 'string') values[key] = value;
    }
  }

  return { version, values };
}

/**
 * Keys the preferences document holds that name ROWS in the user's data.
 *
 * They matter to exactly one caller — the restore, which mints a fresh id for
 * every row it puts back (see backupService.remapBackupIds and the reason it
 * remaps unconditionally). A preference naming accounts by id and restored
 * verbatim would come back pointing at the accounts of the login the file came
 * from: the dashboard's key accounts would silently be six accounts that no
 * longer exist, and the archive cutoffs the owner set per account would apply
 * to nothing. Both fail SILENTLY, which is what makes this worth spelling out.
 */
export const PREFERENCE_KEYS_HOLDING_IDS = {
  /** JSON array of account ids. */
  idArray: [
    'dashboardKeyAccounts',
    'reportsAccountFilterIds',
  ] as readonly string[],
  /** JSON object whose KEYS are account ids. */
  idKeyedObject: [
    'archiveManager.overrides.v1',
  ] as readonly string[],
} as const;
