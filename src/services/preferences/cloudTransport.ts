/**
 * The cloud's preferences store: one `user_preferences` row over PostgREST.
 *
 * ── WHY IT IS HERE AND NOT IN `editions/cloud/preferencesStore.ts` ──────────
 *
 * That module is the seam's cloud HALF, and a half is a choosing line: one
 * export, the one the specifier promises, for the same reason
 * `services/port/index.ts` is one line. This has two more —
 * `supabasePreferencesTransport` under its own name and the table it reads —
 * and `backupService.ts` imports both by path.
 *
 * Left in the half, those two extra names would be exports of `@prefs-store`
 * that only ONE edition has, which is a door shared UI could reach through and
 * only the web build could answer. `editions/__tests__/editionAliases.test.ts`
 * fails on exactly that, and it failed on exactly that, which is how this module
 * came to exist.
 *
 * ── WHY `services/preferences/` ─────────────────────────────────────────────
 *
 * Because `document.ts` is already here. Slice 28 lifted the preferences
 * DOCUMENT into this directory so a desktop bundle could name the shape without
 * naming the service; this is the same family's other half — the cloud's store,
 * in the one place a reader looking for "where do preferences live" would look.
 * The code is `preferencesService.ts`'s, unchanged, moved twice: once to the
 * seam and once to here, and the second move is the one that made the seam thin.
 */

import { supabase } from '../api/supabaseClient';
import {
  parsePreferencesDocument,
  type PreferencesDocument,
  type PreferencesTransport
} from './document';

/** The one row per user that holds one document. */
export const USER_PREFERENCES_TABLE = 'user_preferences';

/**
 * The transport the app uses: the `user_preferences` table over Supabase, or
 * `null` when this session has no cloud at all (local mode, demo mode, a build
 * with no credentials). Null is not an error — it is the honest answer, and the
 * service treats the browser mirror as the store in that case.
 *
 * The client is used INLINE and never assigned to a declared interface, which
 * is what keeps its generics out of every signature in this file.
 */
export function supabasePreferencesTransport(): PreferencesTransport | null {
  const client = supabase;
  if (!client) return null;
  return {
    async read(userId: string): Promise<PreferencesDocument | null> {
      const { data, error } = await client
        .from(USER_PREFERENCES_TABLE)
        .select('prefs')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        // Thrown rather than swallowed: a backup that quietly recorded "no
        // preferences" for a user who has fifty is the failure this whole
        // change exists to end. Callers decide what to do about it.
        throw new Error(`Could not read your preferences: ${error.message}`);
      }
      return data === null ? null : parsePreferencesDocument(data.prefs);
    },
    async write(userId: string, document: PreferencesDocument): Promise<void> {
      const { error } = await client
        .from(USER_PREFERENCES_TABLE)
        .upsert({ user_id: userId, prefs: document }, { onConflict: 'user_id' });
      if (error) {
        throw new Error(`Could not save your preferences: ${error.message}`);
      }
    },
  };
}
