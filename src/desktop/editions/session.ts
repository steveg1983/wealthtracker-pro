/**
 * `@session`, on a device: it already happened.
 *
 * The device half of `editions/session.ts`, and the twin of
 * `editions/cloud/session.ts`. The cloud half is a hundred lines of finding out
 * who is asking; this one has nothing to find out, and the reason is worth
 * stating precisely because "returns nothing" appears three times in this
 * directory and means something different each time.
 *
 * ── IT IS NOT AN ABSENCE, IT IS A DIFFERENT ORDER ───────────────────────────
 *
 * `desktop/editions/chrome.tsx`'s `BackgroundWork` renders nothing because a
 * bank feed cannot exist here. This is not that. Every step the cloud half takes
 * has a device counterpart and every one of them has ALREADY RUN by the time
 * this hook is called:
 *
 *     who is asking          the uuid in the open file's `users` row, published
 *                            by `openDeviceDocument` (deviceIdentity.ts)
 *     make sure they exist   the file IS the row. `LocalDataPort.initialize` is
 *                            a documented no-op for exactly this reason
 *     bind the settings      `bootDeviceLedger(document, { preferences })`, at
 *                            the mount, awaited
 *     seed the categories    the same call, before anything is read
 *     start the sync         there is no server to push to
 *     seed the demo          there is no hosted demo to be in
 *
 * They run at the MOUNT rather than in this hook because they have to. `@data`
 * resolves to `services/local/deviceDataPort.ts`, whose module scope is
 * `requireDeviceDocument().port` — so the application's graph cannot even be
 * IMPORTED until a ledger is open. `src/desktop/DesktopApp.tsx` opens the file,
 * boots it, and only then pulls the app in. By the time a provider renders, the
 * preamble is a thing that happened, and the honest report of it is an empty
 * one.
 *
 * ── WHY IT STILL ANSWERS `owner`, AND WHY THAT IS NOT ALWAYS TRUE ───────────
 *
 * `owner: true` is what turns on the store's own balance figures, which stand in
 * for the seconds a long history is in flight. A file answers those (the crate
 * computes them in one crossing, `account_balances`), so a device wants them for
 * the same reason a login does — a 50,000-row ledger does not paint instantly
 * merely because it is local.
 *
 * It is read from the published identity rather than hard-coded, and the case
 * where that matters is a real one: `forgetDeviceIdentity()` is what closing a
 * ledger means up here, and a tree still mounted over a closed file should say
 * there is nobody rather than assert an owner that is gone.
 */

import { useMemo } from 'react';
import { currentDeviceIdentity } from '../../services/local/deviceIdentity';
import type { EditionSession, UseEditionSession } from '../../editions/session';

/** The same list the cloud half re-exports. */
export type { EditionSession, SessionPreamble, UseEditionSession } from '../../editions/session';

/**
 * Nothing to prepare, and nothing to tidy up after.
 *
 * Frozen and shared rather than rebuilt, so the object below memoises on the
 * owner alone: a device session's identity must be as stable as the file it
 * describes, or a provider that depends on it would re-boot the ledger on every
 * render of its parent.
 */
const NOTHING_TO_DO: Readonly<Record<string, number>> = Object.freeze({});

export const useEditionSession: UseEditionSession = () => {
  const owner = currentDeviceIdentity()?.owner ?? null;

  return useMemo<EditionSession>(
    () => ({
      // A window has no sign-in to wait for. The file was settled before this
      // tree existed — see the header.
      settled: true,
      present: owner !== null,
      prepare: () => Promise.resolve({ owner: owner !== null, phases: NOTHING_TO_DO })
    }),
    [owner]
  );
};
