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
  /**
   * How many connections have STOPPED and need the user to act — `error` or
   * `reauth_required`. Both count: from outside they are one event, the money
   * stopped arriving, and the expired-consent case is the more dangerous
   * because nothing looks broken, the balances just go stale.
   */
  feedsNeedingAttention: number;
  /** True while any connection is mid-sync. */
  isSyncingAny: boolean;
  /** Re-fetch connection metadata (last sync, status) without triggering a sync. */
  reloadConnections: () => Promise<void>;
}

/**
 * How many connections have STOPPED and need the user to act.
 *
 * BOTH failing statuses count, because from outside they are one event: the
 * money stopped arriving. `error` is the bank refusing or failing;
 * `reauth_required` is a consent that has expired — the quieter and more
 * dangerous of the two, because nothing looks broken, the balances simply go
 * stale, and a stale account is indistinguishable from one nobody has spent
 * from.
 *
 * Pure, and here rather than inside the hook, for the same reason
 * `buildAccountBankLinks` is: it is the part worth testing without mounting
 * anything.
 */
export function countFeedsNeedingAttention(connections: readonly BankConnection[]): number {
  return connections.filter(
    (connection) => connection.status === 'error' || connection.status === 'reauth_required'
  ).length;
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
