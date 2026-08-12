/**
 * What a bank connection means to ONE account — the vocabulary, and the pure
 * mapping that produces it.
 *
 * Split out of `hooks/useAccountBankSync.ts` in the mount slice's second half.
 * That module is the bank feed: it holds a Clerk token provider, a connection
 * service and the sync itself, and it is `NEVER_ON_A_DESKTOP` material through
 * and through. This is the part of it that is only a shape and a `forEach`, and
 * the Dashboard and the register import ONLY this part — which is why they were
 * reaching a sign-in provider for the sake of a `Map`.
 *
 * `hooks/useAccountBankSync.ts` re-exports all three names, so nothing that
 * already imported one of them changed.
 */

import type { BankConnection } from '../services/bankConnectionService';

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
  /** Sync every healthy connection, one after another; one summary toast. */
  syncAllConnections: () => Promise<void>;
  /** How many connections a refresh-all would touch. */
  connectedCount: number;
  /** True while any connection is mid-sync. */
  isSyncingAny: boolean;
  /** Re-fetch connection metadata (last sync, status) without triggering a sync. */
  reloadConnections: () => Promise<void>;
}

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
