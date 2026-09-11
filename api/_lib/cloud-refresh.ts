import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncAccountsResponse, SyncTransactionsResponse } from '../../src/types/banking-api.js';
import { getUserBankConnection, type BankConnectionRow } from './banking-sync.js';
import { runAccountSync } from './sync-accounts-core.js';
import { runTransactionSync } from './sync-transactions-core.js';
import { recordSyncFailure, SyncRefusal } from './sync-outcome.js';

/**
 * THE CLOUD REFRESH: every due connection, synced on the owner's behalf.
 *
 * What the hourly cron (api/cron/bank-feeds.ts) actually does, written as a
 * function over injected verbs so the scheduling rules live under test
 * without a database or a bank: which connections it asks for, what it stamps
 * before it speaks to the bank, how it counts, and when it stops.
 *
 * ── FOUR A DAY, AND WHY THAT NUMBER IS NOT OURS ─────────────────────────────
 *
 * PSD2's regulatory technical standards (Art. 36(5)(b)) let an account
 * information service read an account WITHOUT the customer present at most
 * four times a day. Every sync this cron runs is exactly that — nobody is
 * present; that is the point of it — so the interval between unattended
 * syncs of one connection is 24/4 = 6 hours, and the due-list function
 * (migration 20260911153000) measures it from the later of the last SUCCESS
 * and the last ATTEMPT. The attempt is stamped BEFORE the bank is spoken to,
 * which is what keeps a connection that fails from being retried on every
 * hourly run until the bank locks the login. The attended syncs — the button,
 * the refresh-on-open — are outside the cap and do not stamp it.
 *
 * ── ONE RUN, ONE BUDGET ─────────────────────────────────────────────────────
 *
 * A serverless function has a wall-clock limit (vercel.json names it), and a
 * sync is seconds of bank round-trips, so a run takes connections oldest-first
 * until its budget is spent and reports whether it cleared the list. It does
 * not fan out to parallel invocations and it does not sync connections in
 * parallel: banks rate-limit, and a burst of token refreshes is how a whole
 * login gets locked (useAccountBankSync's header, same lesson). A backlog that
 * is not cleared is reported as `exhausted`, which the cron turns into a
 * Sentry warning — the day that fires is the day this needs a queue, and it
 * should be a measured day rather than a guessed one.
 *
 * ── THE SAME SYNC AS THE BUTTON ─────────────────────────────────────────────
 *
 * Accounts then transactions, the order bankConnectionService.syncConnection
 * uses, through the same two cores and the same failure recorder. A reauth
 * discovered here marks the row and shows the Reconnect button exactly as
 * one discovered by the button would; a schema refusal is logged and counted
 * and marks nothing, exactly as it would over HTTP.
 */

/** PSD2 RTS Art. 36(5)(b): at most four unattended reads a day. */
export const UNATTENDED_READS_PER_DAY = 4;
export const HOURS_BETWEEN_UNATTENDED_REFRESHES = 24 / UNATTENDED_READS_PER_DAY;

/** How many due connections one call to the due-list asks for at a time. */
export const DUE_LIST_BATCH = 25;

export interface DueConnection {
  connection_id: string;
  user_id: string;
  institution_name: string;
  last_sync: string | null;
}

export type ConnectionOutcome =
  | { kind: 'synced'; imported: number }
  | { kind: 'reauth_required' }
  | { kind: 'refused'; code: string }
  | { kind: 'failed' }
  /** Listed as due, but the fresh row said otherwise (gone, or reauth'd meanwhile). */
  | { kind: 'skipped' };

export interface ConnectionResult extends DueConnection {
  outcome: ConnectionOutcome;
}

export interface CloudRefreshSummary {
  /** Connections the due-list offered. */
  considered: number;
  synced: number;
  /** New transactions imported across every synced connection. */
  imported: number;
  reauthRequired: number;
  refused: number;
  failed: number;
  skipped: number;
  /** The budget ran out with due connections still unsynced. */
  exhausted: boolean;
  durationMs: number;
  results: ConnectionResult[];
}

/**
 * The verbs a run needs, named so a test can answer them without a database.
 * `cloudRefreshDeps` below binds each one to the real thing.
 */
export interface CloudRefreshDeps {
  now: () => Date;
  /** Due connections, oldest first, neither synced nor attempted since `notSince`. */
  listDue: (notSince: Date, limit: number) => Promise<DueConnection[]>;
  /** Record that the bank is about to be asked — BEFORE it is asked. */
  stampAttempt: (connectionId: string, at: Date) => Promise<void>;
  /** The row with its tokens, or null if it is not (any longer) this user's. */
  loadConnection: (userId: string, connectionId: string) => Promise<BankConnectionRow | null>;
  syncAccounts: (userId: string, connection: BankConnectionRow) => Promise<SyncAccountsResponse>;
  syncTransactions: (userId: string, connection: BankConnectionRow) => Promise<SyncTransactionsResponse>;
  recordFailure: (
    userId: string,
    connectionId: string,
    syncType: 'accounts' | 'transactions',
    error: unknown
  ) => Promise<{ needsReauth: boolean }>;
}

export interface CloudRefreshOptions {
  /** Wall-clock the run may spend before it stops taking new connections. */
  budgetMs: number;
  batchSize?: number;
}

export const cloudRefreshCutoff = (now: Date): Date =>
  new Date(now.getTime() - HOURS_BETWEEN_UNATTENDED_REFRESHES * 60 * 60 * 1000);

const isNeedsReauthRow = (row: BankConnectionRow): boolean =>
  row.needs_reauth === true || row.status === 'reauth_required';

export const runCloudRefresh = async (
  deps: CloudRefreshDeps,
  options: CloudRefreshOptions
): Promise<CloudRefreshSummary> => {
  const startedAt = deps.now();
  const cutoff = cloudRefreshCutoff(startedAt);
  const batchSize = options.batchSize ?? DUE_LIST_BATCH;
  const spent = (): number => deps.now().getTime() - startedAt.getTime();

  const summary: CloudRefreshSummary = {
    considered: 0,
    synced: 0,
    imported: 0,
    reauthRequired: 0,
    refused: 0,
    failed: 0,
    skipped: 0,
    exhausted: false,
    durationMs: 0,
    results: []
  };

  // The attempt stamp is what moves a connection off the due-list, so the
  // list re-asked after a batch is the REMAINDER, not the same rows again.
  // A batch that comes back empty is the list cleared.
  for (;;) {
    if (spent() >= options.budgetMs) {
      // Out of time before even asking: anything still due stays due, and
      // that is a backlog worth knowing about.
      const remaining = await deps.listDue(cutoff, 1);
      summary.exhausted = remaining.length > 0;
      break;
    }

    const batch = await deps.listDue(cutoff, batchSize);
    if (batch.length === 0) break;

    let stoppedEarly = false;
    for (const due of batch) {
      if (spent() >= options.budgetMs) {
        stoppedEarly = true;
        break;
      }
      summary.considered += 1;
      const outcome = await refreshOne(deps, due);
      summary.results.push({ ...due, outcome });
      switch (outcome.kind) {
        case 'synced':
          summary.synced += 1;
          summary.imported += outcome.imported;
          break;
        case 'reauth_required':
          summary.reauthRequired += 1;
          break;
        case 'refused':
          summary.refused += 1;
          break;
        case 'failed':
          summary.failed += 1;
          break;
        case 'skipped':
          summary.skipped += 1;
          break;
      }
    }

    if (stoppedEarly) {
      summary.exhausted = true;
      break;
    }
  }

  summary.durationMs = spent();
  return summary;
};

const refreshOne = async (deps: CloudRefreshDeps, due: DueConnection): Promise<ConnectionOutcome> => {
  // Stamp FIRST. Whatever happens below — a bank that hangs, a function that
  // is killed at its wall-clock limit — this connection is not asked again
  // until the interval has passed.
  await deps.stampAttempt(due.connection_id, deps.now());

  const connection = await deps.loadConnection(due.user_id, due.connection_id);
  if (!connection || isNeedsReauthRow(connection)) {
    return { kind: 'skipped' };
  }

  let syncType: 'accounts' | 'transactions' = 'accounts';
  try {
    await deps.syncAccounts(due.user_id, connection);
    syncType = 'transactions';
    const transactions = await deps.syncTransactions(due.user_id, connection);
    return { kind: 'synced', imported: transactions.transactionsImported };
  } catch (error) {
    if (error instanceof SyncRefusal) {
      // "Could not be attempted", not "the bank failed": a schema this
      // database does not have. Logged by name, marks nothing — the same
      // treatment the handler gives it.
      console.error('[cloud-refresh] sync refused', {
        connectionId: due.connection_id,
        code: error.code,
        message: error.message
      });
      return { kind: 'refused', code: error.code };
    }
    const { needsReauth } = await deps.recordFailure(due.user_id, due.connection_id, syncType, error);
    return needsReauth ? { kind: 'reauth_required' } : { kind: 'failed' };
  }
};

/** The verbs, bound to the database and the two sync cores. */
export const cloudRefreshDeps = (supabase: SupabaseClient): CloudRefreshDeps => ({
  now: () => new Date(),
  listDue: async (notSince, limit) => {
    const { data, error } = await supabase.rpc('cloud_refresh_due_connections', {
      p_not_since: notSince.toISOString(),
      p_limit: limit
    });
    if (error) {
      throw new Error(`Failed to list due connections: ${error.message}`);
    }
    return (data ?? []) as DueConnection[];
  },
  stampAttempt: async (connectionId, at) => {
    const { error } = await supabase
      .from('bank_connections')
      .update({ cloud_refresh_attempted_at: at.toISOString() })
      .eq('id', connectionId);
    if (error) {
      throw new Error(`Failed to stamp the refresh attempt: ${error.message}`);
    }
  },
  loadConnection: (userId, connectionId) => getUserBankConnection(supabase, userId, connectionId),
  syncAccounts: (userId, connection) => runAccountSync(supabase, userId, connection),
  syncTransactions: (userId, connection) => runTransactionSync(supabase, userId, connection, {}),
  recordFailure: (userId, connectionId, syncType, error) =>
    recordSyncFailure(supabase, userId, connectionId, syncType, error, 'cron/bank-feeds')
});
