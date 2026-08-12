import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { bankConnectionService, type BankConnection } from '../services/bankConnectionService';
import { useToast } from '../contexts/ToastContext';
import { createScopedLogger } from '../loggers/scopedLogger';

/**
 * Bank-connection metadata for a single WealthTracker account, surfaced on the
 * Accounts page so each linked account can show its last sync time and offer a
 * one-click "pull fresh bank data" action.
 */
// The two INTERFACES and the pure mapping below them moved to
// `hooks/accountBankLinks.ts` in the mount slice's second half, and are
// re-exported here so nothing that already imported one of them changed.
//
// The reason is the one `utils/demoData.ts` has: a pure helper sharing a module
// with a cloud hook is a pure helper nothing cloud-free can use.
// `components/dashboard/ImprovedDashboard.tsx` and `pages/AccountTransactions.tsx`
// import `buildAccountBankLinks` and nothing else from here, and that one import
// put `@clerk/clerk-react` in front of the Dashboard and the register in a
// desktop build.
export type { AccountBankLink, UseAccountBankSyncResult } from './accountBankLinks';
export { buildAccountBankLinks } from './accountBankLinks';

// …and imported for this module's own use, because a re-export is not a binding.
import { buildAccountBankLinks } from './accountBankLinks';
import type { UseAccountBankSyncResult } from './accountBankLinks';

const logger = createScopedLogger('useAccountBankSync');

export function useAccountBankSync(options?: { onSynced?: () => void | Promise<void> }): UseAccountBankSyncResult {
  const onSynced = options?.onSynced;
  const { getToken, isSignedIn } = useClerkAuth();
  const { showSuccess, showWarning, showError } = useToast();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [syncingConnectionIds, setSyncingConnectionIds] = useState<Set<string>>(new Set());

  const reloadConnections = useCallback(async () => {
    await bankConnectionService.refreshConnections();
    setConnections(bankConnectionService.getConnections());
  }, []);

  // Register the auth-token provider ONCE with a stable closure that reads the
  // latest getToken via a ref — Clerk's getToken is not referentially stable,
  // and keying an effect on it re-ran the fetch on every render (a loop of
  // "Missing authentication token" errors in demo/signed-out mode).
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  useEffect(() => {
    bankConnectionService.setAuthTokenProvider(() => getTokenRef.current());
  }, []);

  // Load connections only when signed in. isSignedIn flipping false→true is
  // the recover-on-token-arrival signal (a first mount that raced ahead of
  // Clerk still re-fetches once the session exists); signed-out/demo sessions
  // never fetch and never log auth errors.
  useEffect(() => {
    if (!isSignedIn) {
      setConnections([]);
      return;
    }
    void reloadConnections();
  }, [isSignedIn, reloadConnections]);

  const linksByAccountId = useMemo(() => buildAccountBankLinks(connections), [connections]);

  const getAccountLink = useCallback(
    (accountId: string) => linksByAccountId.get(accountId),
    [linksByAccountId]
  );

  const isAccountSyncing = useCallback(
    (accountId: string) => {
      const link = linksByAccountId.get(accountId);
      return link ? syncingConnectionIds.has(link.connectionId) : false;
    },
    [linksByAccountId, syncingConnectionIds]
  );

  const syncAccount = useCallback(
    async (accountId: string) => {
      const link = linksByAccountId.get(accountId);
      if (!link) {
        return;
      }
      const { connectionId, institutionName } = link;
      // Guard against repeat clicks while this connection is already syncing.
      if (syncingConnectionIds.has(connectionId)) {
        return;
      }

      setSyncingConnectionIds((prev) => new Set(prev).add(connectionId));

      try {
        const result = await bankConnectionService.syncConnection(connectionId);
        // syncConnection refreshes the service cache; mirror it into React state so
        // the "Last synced" label and connection status update immediately.
        setConnections(bankConnectionService.getConnections());

        if (result.success) {
          if (onSynced) {
            await onSynced();
          }
          const imported = result.transactionsImported;
          showSuccess(
            imported > 0
              ? `Imported ${imported} new transaction${imported === 1 ? '' : 's'} from ${institutionName}.`
              : `${institutionName} is up to date — no new transactions.`,
            'Bank sync complete'
          );
        } else {
          // A failed sync (e.g. expired consent → HTTP 409) is caught inside
          // syncConnection and returned as { success: false } WITHOUT refreshing
          // the cache, so re-fetch to surface any reauth_required status flip.
          await reloadConnections();
          showWarning(result.errors[0] ?? 'The bank sync did not complete.', 'Bank sync incomplete');
        }
      } catch (error) {
        logger.error('Failed to sync bank account', error as Error);
        showError(error);
        // A failure can flip the connection to reauth_required; surface it.
        await reloadConnections();
      } finally {
        setSyncingConnectionIds((prev) => {
          const next = new Set(prev);
          next.delete(connectionId);
          return next;
        });
      }
    },
    [linksByAccountId, syncingConnectionIds, onSynced, reloadConnections, showSuccess, showWarning, showError]
  );

  // One hit for every healthy connection, sequentially — banks rate-limit,
  // and a burst of parallel token refreshes is how a "refresh all" gets a
  // whole login temporarily locked. Per-connection toasts are suppressed in
  // favour of one summary; failures are counted, not fatal, so one broken
  // connection cannot stop the rest of the round.
  const syncAllConnections = useCallback(async () => {
    const targets = connections.filter(
      (c) => c.status === 'connected' && !syncingConnectionIds.has(c.id)
    );
    if (targets.length === 0) {
      return;
    }

    setSyncingConnectionIds((prev) => {
      const next = new Set(prev);
      targets.forEach((t) => next.add(t.id));
      return next;
    });

    let imported = 0;
    let failed = 0;
    try {
      for (const target of targets) {
        try {
          const result = await bankConnectionService.syncConnection(target.id);
          if (result.success) {
            imported += result.transactionsImported;
          } else {
            failed += 1;
          }
        } catch (error) {
          logger.error('Refresh-all: connection sync failed', error as Error);
          failed += 1;
        } finally {
          setSyncingConnectionIds((prev) => {
            const next = new Set(prev);
            next.delete(target.id);
            return next;
          });
        }
      }

      // One reload at the end covers every status flip (incl. reauth_required).
      await reloadConnections();
      if (failed === 0 && onSynced) {
        await onSynced();
      }

      const done = targets.length - failed;
      if (failed > 0) {
        showWarning(
          `Refreshed ${done} of ${targets.length} connections — ${failed} did not complete. Check Bank Connections.`,
          'Feed refresh incomplete'
        );
      } else {
        showSuccess(
          imported > 0
            ? `Refreshed ${done} connection${done === 1 ? '' : 's'} — ${imported} new transaction${imported === 1 ? '' : 's'}.`
            : `Refreshed ${done} connection${done === 1 ? '' : 's'} — everything is up to date.`,
          'Feeds refreshed'
        );
      }
    } catch (error) {
      logger.error('Refresh-all failed', error as Error);
      showError(error);
      await reloadConnections();
    }
  }, [connections, syncingConnectionIds, onSynced, reloadConnections, showSuccess, showWarning, showError]);

  const connectedCount = useMemo(
    () => connections.filter((c) => c.status === 'connected').length,
    [connections]
  );

  return {
    getAccountLink,
    isAccountSyncing,
    syncAccount,
    syncAllConnections,
    connectedCount,
    isSyncingAny: syncingConnectionIds.size > 0,
    reloadConnections,
  };
}
