/**
 * `@prefs-store`, in a browser: one `user_preferences` row over PostgREST.
 *
 * The cloud half of the seam `editions/preferencesStore.ts` declares, and the
 * twin of `desktop/editions/preferencesStore.ts`. One typed re-binding, for the
 * reason `services/port/index.ts` is one line: the CHOICE is the file, and a
 * choosing file that also does work is a file whose work only one edition gets.
 *
 * The work itself is in `services/preferences/cloudTransport.ts` — which is
 * `preferencesService.ts`'s own code, moved rather than written, and which has
 * two exports this seam deliberately does not carry. That module's header says
 * why, and the reason is a test failure that happened rather than one that was
 * anticipated.
 */

import { supabasePreferencesTransport } from '../../services/preferences/cloudTransport';
import type { DefaultPreferencesTransport } from '../preferencesStore';

/** One specifier, values and types together. See `services/port/index.ts`. */
export type { DefaultPreferencesTransport } from '../preferencesStore';

export const defaultPreferencesTransport: DefaultPreferencesTransport = supabasePreferencesTransport;
