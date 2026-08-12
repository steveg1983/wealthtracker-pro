/**
 * WHERE SETTINGS LIVE WHEN NOBODY HAS SAID — the contract, named by neither
 * edition.
 *
 * `PreferencesService` has three states for its store and only two of them can
 * be reached by asking (`useTransport` takes a transport or `null`; it cannot
 * restore `undefined`). The third — *"nobody has said"* — is the one this seam
 * is about: it is the state the service is BORN in, and its answer used to be
 * `supabasePreferencesTransport()`, a function reading a module-scope Supabase
 * client on the second line of `preferencesService.ts`.
 *
 * That one call is why `contexts/PreferencesContext.tsx` — a context about
 * theme, currency and which accounts are pinned — reached `@supabase/supabase-js`
 * from the shared Layout, and it is slice 29's third cloud root.
 *
 * ── WHY THE FALLBACK IS THE SEAM, AND NOT THE SERVICE ───────────────────────
 *
 * A device never uses this answer. `bootDeviceLedger` calls
 * `useTransport(document.preferences)` before a surface renders, so by the time
 * anything reads a setting the store is the open ledger file. The problem was
 * never that the desktop would CALL the cloud's fallback; it is that a desktop
 * bundle would CONTAIN it. Moving the default behind a specifier the build
 * resolves is therefore the whole fix: nothing about the service's behaviour
 * changes in either edition, and one bundle stops carrying a database client it
 * would never have called.
 *
 * ── WHAT `null` MEANS, BECAUSE IT IS NOT AN ERROR ───────────────────────────
 *
 * *"There is no store; this machine's mirror IS the store."* A signed-out
 * browser, a demo session and a build with no credentials all answer that today
 * and the service is built for it. It is what the device half answers too, and
 * the device half says why it is safe there and what makes it so.
 */

import type { PreferencesTransport } from '../services/preferences/document';

/**
 * The store to use when nobody has said which one — or `null` for *"there is
 * none"*.
 *
 * Called on every resolve rather than once at import, because the cloud's
 * answer depends on a client that may not exist yet when this module is first
 * evaluated. Both editions are cheap enough for that to be free.
 */
export type DefaultPreferencesTransport = () => PreferencesTransport | null;
