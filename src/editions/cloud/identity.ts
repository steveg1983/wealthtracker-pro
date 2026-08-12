/**
 * `@identity`, in a browser: whoever signed in.
 *
 * The cloud half of the seam `editions/identity.ts` declares, and the twin of
 * `desktop/editions/identity.ts`.
 *
 * `user` is `undefined` until Clerk has loaded and `null` when nobody is signed
 * in, and both become `null` here on purpose: the difference between "not yet"
 * and "nobody" is a real one, and it is not a difference any CONSUMER of this
 * seam can act on. They persist under a key or they do not, and a hook that
 * returned three states would push a decision nobody can make out to every
 * caller. The consequence is stated in the contract: a surface loads in memory
 * first and persists once the key arrives, which is what they all already did.
 */

import { useUser } from '@clerk/clerk-react';
import type { UseIdentityKey } from '../identity';

/** One specifier, values and types together. See `services/port/index.ts`. */
export type { UseIdentityKey } from '../identity';

export const useIdentityKey: UseIdentityKey = () => {
  const { user } = useUser();
  return user?.id ?? null;
};
