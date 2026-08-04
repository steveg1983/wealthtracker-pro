import { useEffect, useRef } from 'react';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useAccountBankSync } from './useAccountBankSync';
import {
  loadAutoSyncPrefs,
  loadLastAutoSyncRun,
  recordAutoSyncRun,
  shouldAutoSync,
} from '../utils/bankAutoSync';
import { createScopedLogger } from '../loggers/scopedLogger';

const logger = createScopedLogger('useAutoBankSync');

/** How often the schedule is re-checked while the app sits open. */
const CHECK_INTERVAL_MS = 60_000;

/**
 * The automatic bank-feed refresh, mounted once in Layout.
 *
 * Checks the user's schedule on sign-in and then once a minute while the app
 * is open; when a refresh is due (see shouldAutoSync for the rules) it stamps
 * the run FIRST and then syncs every healthy connection. Stamp-then-sync is
 * deliberate: if the sync fails, the next attempt is the next scheduled
 * moment, not a retry storm every minute against a bank that just said no.
 * The user always has the manual refresh button for a failed round.
 *
 * Does nothing signed out, and nothing when the mode is 'off' — including no
 * timers.
 */
export function useAutoBankSync(): void {
  const { userId, isSignedIn } = useClerkAuth();
  const { syncAllConnections, connectedCount } = useAccountBankSync();

  // The interval callback reads these through refs so the timer is set up
  // once per user, not torn down whenever a connection syncs.
  const syncRef = useRef(syncAllConnections);
  syncRef.current = syncAllConnections;
  const connectedRef = useRef(connectedCount);
  connectedRef.current = connectedCount;

  useEffect(() => {
    if (!isSignedIn || !userId) return;

    const check = (): void => {
      const prefs = loadAutoSyncPrefs(userId);
      if (prefs.mode === 'off') return;
      if (connectedRef.current === 0) return;
      if (!shouldAutoSync(prefs, loadLastAutoSyncRun(userId), new Date())) return;

      recordAutoSyncRun(userId, new Date());
      logger.info('Auto-refreshing bank feeds', { mode: prefs.mode });
      void syncRef.current();
    };

    // Connections load asynchronously after sign-in; a short delay gives the
    // first check something to act on instead of always skipping on boot.
    const boot = setTimeout(check, 5_000);
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      clearTimeout(boot);
      clearInterval(interval);
    };
  }, [isSignedIn, userId]);
}
