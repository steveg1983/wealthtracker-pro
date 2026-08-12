/**
 * `@prefs-store`, on a device: there is no default, because there is no guess to
 * make.
 *
 * The device half of `editions/preferencesStore.ts`, and the twin of
 * `editions/cloud/preferencesStore.ts`.
 *
 * ── WHY `null` IS THE RIGHT ANSWER AND NOT A GAP ────────────────────────────
 *
 * A browser's default store is a property of the BUILD: there is one database,
 * it is always the same one, and asking for it costs nothing. A device's store
 * is a property of the SESSION — it is a file somebody chose, and before they
 * have chosen one there is no store in existence to name. So the cloud can have
 * a default and this cannot, and answering `null` says exactly that: *"there is
 * no store; this machine's mirror is the store"*, which is the state a
 * signed-out browser is already in and which `PreferencesService` is already
 * built for.
 *
 * The moment a ledger IS open, `bootDeviceLedger` calls
 * `preferences.useTransport(document.preferences)` — the file's own two verbs —
 * before a single surface renders. From then on this function is never
 * consulted again: `resolveTransport` returns the override, and an override is
 * not restorable to *"nobody has said"*.
 *
 * ── WHY IT DOES NOT THROW ───────────────────────────────────────────────────
 *
 * Throwing would be the louder way to state the ordering rule, and it would
 * fire in the one window where nothing is wrong: the chooser. A desktop opens
 * showing "which ledger?" — no file, no owner, and a `PreferencesService` that
 * has been imported but has nothing to attach to. Refusing there would turn the
 * first screen of the application into a crash to make a point about the second.
 *
 * The ordering rule is stated where it can be enforced instead:
 * `deviceDataPort.ts` and `requireDeviceDocument` both throw if the application
 * is loaded before a ledger is open, which is the same mistake one layer down
 * and a layer that can afford to refuse.
 */

import type { DefaultPreferencesTransport } from '../../editions/preferencesStore';

/** The same list the cloud half re-exports. */
export type { DefaultPreferencesTransport } from '../../editions/preferencesStore';

export const defaultPreferencesTransport: DefaultPreferencesTransport = () => null;
