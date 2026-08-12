/**
 * `@session`, in a browser: Clerk, and the four things that follow from it.
 *
 * The cloud half of the seam `editions/session.ts` declares, and the twin of
 * `desktop/editions/session.ts`. Every line below was lifted out of
 * `contexts/AppContextSupabase.tsx`'s boot effect and is here unchanged — same
 * order, same awaits, same log lines, same scope on the logger, so a console
 * from before this seam and one from after read identically.
 *
 * ── IT IS THE ONLY FILE IN THE APP THAT NEEDS THE PERSON ────────────────────
 *
 * `ensureUserExists` may have to CREATE the row, so it needs an email and a
 * name, not an id. That is the fact that decided the seam's shape: the hook
 * closes over Clerk's `user` and hands back a `prepare` that already has it, so
 * the user never crosses the seam and the device half never has to pretend it
 * has one. See the contract's note.
 *
 * ── THE ONE THING THAT IS NOT A STRAIGHT LIFT ───────────────────────────────
 *
 * The phases. The boot effect used to call its own `markPhase` between these
 * awaits; a preamble on the far side of a seam cannot reach that closure, so it
 * measures its own two and REPORTS them. The caller merges the record, exactly
 * as it already merges `loadBoot`'s. Same two names, same two numbers, same
 * place in the summary line.
 */

import { useMemo } from 'react';
import { useUser } from '@clerk/clerk-react';
import { dataPort } from '@data';
import AutoSyncService from '../../services/autoSyncService';
import { transactionCache } from '../../services/transactionCache';
import { userIdService } from '../../services/userIdService';
import { initializeDemoData } from '../../utils/demoSeed';
import { preferences as preferencesService } from '../../services/preferencesService';
import { createScopedLogger } from '../../loggers/scopedLogger';
import type { EditionSession, SessionPreamble, UseEditionSession } from '../session';

/** One specifier, values and types together. See `services/port/index.ts`. */
export type { EditionSession, SessionPreamble, UseEditionSession } from '../session';

/**
 * The SAME scope the state layer logs under, deliberately.
 *
 * These lines used to be printed by `AppContext`'s logger because they were
 * inside `AppContext`. They are the same lines about the same boot, and giving
 * them a new scope would have been a change to what a person reads in a console
 * dressed up as a change to where the code lives.
 */
const sessionLogger = createScopedLogger('AppContext');

/** What Clerk knows, as the two facts the seam is about. */
type ClerkUser = ReturnType<typeof useUser>['user'];

/**
 * The preamble, bound to one session.
 *
 * Built outside the hook so the hook is four lines and this is readable as the
 * boot fragment it is.
 */
const prepareCloudSession = async (user: ClerkUser): Promise<SessionPreamble> => {
  const phases: Record<string, number> = {};
  let phaseStart = performance.now();
  const markPhase = (name: string): void => {
    phases[name] = Math.round(performance.now() - phaseStart);
    phaseStart = performance.now();
  };

  sessionLogger.info('Initializing app context', { userId: user?.id });

  // Demo mode seeds its sample data into the same storage every read below
  // goes through, and it is awaited HERE rather than fired from App's effect:
  // the two used to race, and when the load won, demo mode came up empty and
  // stayed empty. A no-op outside demo mode.
  await initializeDemoData();

  if (!user) {
    // No user logged in
    sessionLogger.info('No user logged in');
    // Signed out (the boot effect re-runs when Clerk's user goes away, however
    // the sign-out was triggered): the cached history belongs to whoever was
    // signed in and must not survive on a shared browser.
    void transactionCache.clear();
    // Stop writing this browser's copy up to a login that is no longer here.
    // The mirror stays: it is what the next signed-out session reads, and it
    // belongs to the browser rather than to the account.
    preferencesService.detach();
    return { owner: false, phases };
  }

  sessionLogger.info('User found, initializing services');

  // Initialize userIdService first - this is now the single source of truth
  const databaseId = await userIdService.ensureUserExists(
    user.id,
    user.emailAddresses[0]?.emailAddress || '',
    user.firstName || undefined,
    user.lastName || undefined
  );
  markPhase('auth');

  if (!databaseId) {
    sessionLogger.warn('Failed to resolve database user ID - no data will be loaded');
    return { owner: false, phases };
  }

  sessionLogger.info('Database user ID resolved', { databaseId });

  // Bind the preferences document to this login. Deliberately NOT awaited: it
  // is one small read that nothing on the critical path depends on, every
  // surface already has this browser's copy to start from, and the service
  // notifies its subscribers when the account's own settings land a moment
  // later. Awaiting it would put a round trip in front of the first account
  // query for no gain, and a slow or missing preferences table would delay the
  // ledger.
  void preferencesService.attach(databaseId);

  // Initialize AutoSync with the database ID ready
  await AutoSyncService.initialize(user.id);

  await dataPort.initialize(
    user.id,
    user.emailAddresses[0]?.emailAddress || '',
    user.firstName || undefined,
    user.lastName || undefined
  );
  sessionLogger.info('Loading application data');
  markPhase('services');

  return { owner: true, phases };
};

/**
 * Whoever signed in, and what has to happen before their ledger can be read.
 *
 * Memoised on `[user, isLoaded]`, which is not a detail: those two were the boot
 * effect's dependency array before this seam existed, so an object with that
 * memo has exactly the identity the effect used to depend on. A boot re-runs
 * when a person signs in, signs out, or changes — and at no other time.
 */
export const useEditionSession: UseEditionSession = () => {
  const { user, isLoaded } = useUser();

  return useMemo<EditionSession>(
    () => ({
      settled: isLoaded,
      present: Boolean(user),
      prepare: () => prepareCloudSession(user)
    }),
    [user, isLoaded]
  );
};
