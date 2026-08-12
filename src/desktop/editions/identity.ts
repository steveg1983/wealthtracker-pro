/**
 * `@identity`, on a device: the ledger that is open.
 *
 * The device half of `editions/identity.ts`, and the twin of
 * `editions/cloud/identity.ts`. One line of body, and every interesting thing
 * about it is in the two modules it sits between.
 *
 * ── WHY THE OWNER AND NOT THE PATH ──────────────────────────────────────────
 *
 * Both are in `DeviceIdentity` and either would namespace a key. The owner is
 * the right one because it is what the FILE says about itself: a ledger copied
 * to a second machine, or moved to a different folder, is the same ledger and
 * should find the notifications it had. A path-scoped key would quietly reset
 * them on a rename, which is exactly the class of failure `preferencesTransport`
 * exists to prevent one layer down — settings that do not travel with the file.
 *
 * ── WHY IT IS NOT REACTIVE, AND WHY THAT IS SAFE ────────────────────────────
 *
 * `deviceIdentity.ts` publishes a value rather than a subscription, because the
 * identity cannot change under a mounted tree: opening a different ledger
 * replaces the document and the application is booted against it. A hook that
 * reads it at render is therefore correct without a subscription — and this is a
 * hook rather than a plain function only because its cloud twin must be one.
 *
 * `null` is the chooser: a window with no ledger open, which is the first thing
 * a desktop shows and is not an error.
 */

import { currentDeviceIdentity } from '../../services/local/deviceIdentity';
import type { UseIdentityKey } from '../../editions/identity';

/** The same list the cloud half re-exports. */
export type { UseIdentityKey } from '../../editions/identity';

export const useIdentityKey: UseIdentityKey = () => currentDeviceIdentity()?.owner ?? null;
