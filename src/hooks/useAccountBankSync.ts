import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { bankConnectionService, type BankConnection } from '../services/bankConnectionService';
import { useToast } from '../contexts/ToastContext';
import { createScopedLogger } from '../loggers/scopedLogger';

/**
 * Bank-connection metadata for a single WealthTracker account, surfaced on the
 * Accounts page so each linked account can show its last sync time and offer a
 * one-click "pull fresh bank data" action.
 */
export interface AccountBankLink {
  /** The bank connection that owns this account (a login may cover several accounts). */
  connectionId: string;
  institutionName: string;
  status: BankConnection['status'];
  lastSync?: Date;
}

export interface UseAccountBankSyncResult {
  /** Bank link for an account, or undefined for manual/unlinked accounts. */
  getAccountLink: (accountId: string) => AccountBankLink | undefined;
  /** True while this account's connection is mid-sync. */
  isAccountSyncing: (accountId: string) => boolean;
  /** Pull fresh accounts + transactions for the account's whole bank connection. */
  syncAccount: (accountId: string) => Promise<void>;
  /** Re-fetch connection metadata (last sync, status) without triggering a sync. */
  reloadConnections: () => Promise<void>;
}

const logger = createScopedLogger('useAccountBankSync');

/**
 * Flatten bank connections into an account-id → link map. A connection can back
 * several WealthTracker accounts, so each linked id points back at the shared
 * connection metadata. Pure to keep the mapping unit-testable.
 */
export function buildAccountBankLinks(connections: BankConnection[]): Map<string, AccountBankLink> {
  const map = new Map<string, AccountBankLink>();
  connections.forEach((connection) => {
    connection.linkedAccountIds.forEach((accountId) => {
      map.set(accountId, {
        connectionId: connection.id,
        institutionName: connection.institutionName,
        status: connection.status,
        lastSync: connection.lastSync
      });
    });
  });
  return map;
}

export function useAccountBankSync(options?: { onSynced?: () => void | Promise<void> }): UseAccountBankSyncResult {
  const onSynced = options?.onSynced;
  const { getToken } = useClerkAuth();
  const { showSuccess, showWarning, showError } = useToast();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [syncingConnectionIds, setSyncingConnectionIds] = useState<Set<string>>(new Set());

  const reloadConnections = useCallback(async () => {
    await bankConnectionService.refreshConnections();
    setConnections(bankConnectionService.getConnections());
  }, []);

  // Keep the auth-token provider current and (re)load connections. Depending on
  // getToken means that if the first mount raced ahead of Clerk minting a token,
  // we re-fetch once a usable token exists instead of staying empty all visit.
  useEffect(() => {
    bankConnectionService.setAuthTokenProvider(() => getToken());
    void reloadConnections();
  }, [getToken, reloadConnections]);

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

  return { getAccountLink, isAccountSyncing, syncAccount, reloadConnections };
}
