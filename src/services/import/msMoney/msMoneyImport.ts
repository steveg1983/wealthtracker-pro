/**
 * Microsoft Money import execution — the destructive "total migration".
 *
 * Takes the app-shaped collections produced by `transformMsMoneyExport` and
 * replaces ALL of the user's data with them. Two write paths share one plan:
 *
 *  - LOCAL (demo / signed-out): rewrites the wealthtracker_* storage keys
 *    through `storageAdapter`, the same contract demo seeding uses — which is
 *    also the only place the app's readers look.
 *  - CLOUD (signed in): wipes then batch-inserts through the authenticated
 *    Supabase client under RLS — the same ordered wipe + two-pass transfer
 *    linking + split-leg pinning proven by scripts/mnyCloudImport.mts, minus
 *    the service role (each row is the user's own, so RLS permits it).
 *
 * DESTRUCTIVE: the caller MUST gate this behind an explicit confirmation and
 * (per the import UI) a fresh export of the current data. Balances are written
 * as the reconstructed final values, so no per-row balance maths runs here.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Transaction } from '../../../types';
import { createScopedLogger } from '../../../loggers/scopedLogger';
import { storageAdapter } from '../../storageAdapter';
import type { MsMoneyImportResult } from './transform';

// ── The PLANNER, which is no longer here ────────────────────────────────────
//
// Slice 27 lifted it into `cloudPlan.ts` so that a desktop bundle can turn a
// .mny file into rows without this module's `storageAdapter` and cloud logger in
// its scope — the obligation `localDataPort.ts`'s `MsMoneyMigration` recorded.
// It is a MOVE: every name below is re-exported from here, so nothing that
// already imported one of them changed, and there is still exactly one planner.
export {
  MS_MONEY_IMPORT_SOURCE,
  RECONCILED_COLUMN,
  planCloudImport,
  reconciledFromMoney,
  type CloudPlan,
  type CloudPlanOptions,
  type ExistingAccountRow,
  type ExistingCategoryRow,
  type ExistingTransactionLinks,
  type FeedTransferPromotion,
  type OpeningBalanceMismatch,
} from './cloudPlan';

import {
  MS_MONEY_IMPORT_SOURCE,
  RECONCILED_COLUMN,
  planCloudImport,
  reconciledFromMoney,
  type CloudPlan,
  type CloudPlanOptions,
  type ExistingAccountRow,
  type ExistingCategoryRow,
  type ExistingTransactionLinks,
} from './cloudPlan';


const logger = createScopedLogger('msMoneyImport');

export type ImportPhase =
  | 'wiping' | 'accounts' | 'categories' | 'transactions' | 'links' | 'splits' | 'verifying' | 'done';

export interface ImportProgress {
  phase: ImportPhase;
  /** 0–1 overall fraction, for a progress bar. */
  fraction: number;
  message: string;
}

export interface ImportOptions {
  onProgress?: (p: ImportProgress) => void;
  /**
   * Transient-failure policy for the cloud write path. A 50,000-row import over
   * a domestic connection WILL meet a dropped socket sooner or later; the
   * defaults below are what ships. Tests override them to run without timers.
   */
  retry?: {
    /** Total attempts per write, first included. Default {@link WRITE_ATTEMPTS}. */
    attempts?: number;
    /** First backoff in ms; doubles each attempt. Default {@link RETRY_BASE_MS}. */
    baseDelayMs?: number;
    /** How the backoff waits. Defaults to a real timer. */
    sleep?: (ms: number) => Promise<void>;
  };
}

/** Attempts per write, the first included: 1 try + 4 retries. */
export const WRITE_ATTEMPTS = 5;
/** First backoff, doubling each attempt: 0.5s, 1s, 2s, 4s — ~7.5s in total. */
export const RETRY_BASE_MS = 500;

/**
 * Is this failure worth trying again?
 *
 * Only the network and the far end's own distress qualify: a dropped socket
 * (supabase-js reports a failed fetch as status 0), a timeout, a rate limit, or
 * a 5xx. Everything else — a unique violation, a null in a NOT NULL column, a
 * failed CHECK — is a genuine data error that will fail identically forever, so
 * retrying it only wastes the user's time and buries the real message.
 */
export function isRetryableWriteStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
}

/** The part of a PostgREST response the write path cares about. */
export interface WriteOutcome {
  error: { message: string; code?: string | null } | null;
  status: number;
}
/**
 * The two ways a database refuses a write that names a column it has not got.
 *
 * `42703` is Postgres's own `undefined_column`. `PGRST204` is PostgREST's
 * "could not find the column in the schema cache", and is what actually comes
 * back from an INSERT or an UPSERT: PostgREST validates the payload's keys
 * against its cached schema before the statement ever reaches Postgres. Both
 * are checked because which one arrives depends on the PostgREST version and
 * on whether its cache is warm.
 *
 * Matched on the CODES and never on the message, for the same reason
 * src/services/api/transactionService.ts's boot ladder does it that way: the
 * codes are the documented wire contract, the messages are English prose that
 * has changed between releases.
 */
const UNDEFINED_COLUMN = '42703';
const POSTGREST_UNKNOWN_COLUMN = 'PGRST204';

const isUnknownColumn = (error: { code?: string | null }): boolean =>
  error.code === UNDEFINED_COLUMN || error.code === POSTGREST_UNKNOWN_COLUMN;
/**
 * The slice of the Supabase client `executeCloudPlan` actually uses. Narrow
 * enough that a test can supply a real implementation of it — no cast, no
 * mocking of a client that would then prove nothing about the batching.
 */
export interface CloudWriteClient {
  from(table: string): {
    insert(rows: Record<string, unknown>[]): PromiseLike<WriteOutcome>;
    upsert(
      rows: Record<string, unknown>[],
      options: { onConflict: string; ignoreDuplicates: boolean }
    ): PromiseLike<WriteOutcome>;
  };
}

/** Rows per HTTP request on every batched write. */
export const IMPORT_BATCH_SIZE = 500;
const chunk = <T>(arr: T[], size = IMPORT_BATCH_SIZE): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
/** Conflict target matching `transactions_import_source_unique`. */
export const IMPORT_PROVENANCE_CONFLICT = 'user_id,import_source,import_source_id';

// ── LOCAL path ───────────────────────────────────────────────────────────────

/**
 * The slice of browser storage this import writes through.
 *
 * `setMany` is one IndexedDB readwrite transaction, so the migration lands
 * whole or not at all. A per-key loop could not promise that: a failure on the
 * fifth key would leave the file's accounts beside the previous data's
 * transactions, and no reconciliation could make sense of the result.
 */
export interface LocalImportStore {
  setMany(entries: ReadonlyArray<{ key: string; value: unknown }>): Promise<void>;
}

export interface LocalImportOptions extends ImportOptions {
  /** Defaults to the adapter the app itself reads through. */
  store?: LocalImportStore;
}

/**
 * Replace local storage with the imported collections.
 *
 * Written through `storageAdapter`, because that — storageAdapter →
 * encryptedStorage → IndexedDB — is where every reader in the app looks. This
 * used to call `window.localStorage.setItem` directly, which is the same defect
 * `wipeLocalData` carried (see the note further down) and the same one
 * mnyLocalImport documents for the dev seed: the keys it wrote were not the
 * keys anything read, so a local-mode Money import reported success and left
 * the app showing exactly what it showed before. Its test asserted on
 * `window.localStorage` and passed for the same reason.
 */
export async function importToLocalStorage(
  result: MsMoneyImportResult,
  storageKeys: { ACCOUNTS: string; TRANSACTIONS: string; CATEGORIES: string; TRANSACTION_SPLITS: string; BUDGETS: string; GOALS: string; RECURRING: string },
  opts: LocalImportOptions = {}
): Promise<void> {
  const { onProgress } = opts;
  const store = opts.store ?? storageAdapter;

  onProgress?.({ phase: 'accounts', fraction: 0.2, message: 'Preparing your data…' });
  const entries: { key: string; value: unknown }[] = [
    { key: storageKeys.ACCOUNTS, value: result.accounts },
    { key: storageKeys.CATEGORIES, value: result.categories },
    // The committed flag is stamped HERE rather than left off: the device store
    // holds whatever it was last written with, and a row with no answer is read
    // through `cleared` — which now carries Money's C as well, so an unstamped
    // import would read a whole unfinished balance session as committed. See
    // `reconciledFromMoney` for the rule itself.
    {
      key: storageKeys.TRANSACTIONS,
      value: result.transactions.map((t): Transaction => ({ ...t, reconciled: reconciledFromMoney(t) })),
    },
    { key: storageKeys.TRANSACTION_SPLITS, value: result.transactionSplits },
    // Everything else starts clean — a total migration replaces, never merges.
    { key: storageKeys.BUDGETS, value: [] },
    { key: storageKeys.GOALS, value: [] },
    { key: storageKeys.RECURRING, value: [] },
  ];

  // One phase, because there is one write. Reporting "writing accounts…",
  // "writing categories…" against a single atomic call would be inventing
  // progress the import does not make.
  onProgress?.({ phase: 'transactions', fraction: 0.5, message: 'Writing your data…' });
  await store.setMany(entries);
  onProgress?.({ phase: 'done', fraction: 1, message: 'Import complete.' });
}

// ── CLOUD path (batched inserts under RLS) ──────────────────────────────────
/** An already-imported row, keyed in the map below by its `import_source_id`. */
export interface ImportedTransactionRow extends ExistingTransactionLinks {
  id: string;
}

/**
 * Every `import_source_id` this user already holds for a given importer → the
 * transaction id it already has, and the transfer links it already carries.
 * Paged, because a full Money file is tens of thousands of rows and PostgREST
 * caps a single response.
 *
 * The links come along on the same read precisely because it is free: the plan
 * uses them to leave already-linked rows out of the second pass entirely.
 */
export async function fetchImportedTransactions(
  supabase: SupabaseClient,
  userId: string,
  importSource: string = MS_MONEY_IMPORT_SOURCE
): Promise<Map<string, ImportedTransactionRow>> {
  const PAGE = 1000;
  const out = new Map<string, ImportedTransactionRow>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, import_source_id, linked_transfer_id, linked_transfer_split_id')
      .eq('user_id', userId)
      .eq('import_source', importSource)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed reading import provenance: ${error.message}`);
    const rows = (data ?? []) as {
      id: string; import_source_id: string | null;
      linked_transfer_id: string | null; linked_transfer_split_id: string | null;
    }[];
    for (const r of rows) {
      if (!r.import_source_id) continue;
      out.set(r.import_source_id, {
        id: r.id,
        linkedTransferId: r.linked_transfer_id ?? null,
        linkedTransferSplitId: r.linked_transfer_split_id ?? null,
      });
    }
    if (rows.length < PAGE) return out;
  }
}

/** Every category row this user holds, paged like the provenance read. */
export async function fetchExistingCategories(
  supabase: SupabaseClient,
  userId: string
): Promise<ExistingCategoryRow[]> {
  const PAGE = 1000;
  const out: ExistingCategoryRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, type, level, parent_id, is_system')
      .eq('user_id', userId)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed reading existing categories: ${error.message}`);
    const rows = (data ?? []) as ExistingCategoryRow[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** Every account row this user holds, paged like the provenance read. */
export async function fetchExistingAccounts(
  supabase: SupabaseClient,
  userId: string
): Promise<ExistingAccountRow[]> {
  const PAGE = 1000;
  const out: ExistingAccountRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('accounts')
      // `initial_balance` comes along so the plan can SAY when a reused
      // account's opening balance disagrees with the file (see
      // CloudPlan.openingBalanceMismatches). Reading it costs nothing; not
      // reading it is how the disagreement stayed invisible.
      .select('id, name, parent_account_id, initial_balance')
      .eq('user_id', userId)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed reading existing accounts: ${error.message}`);
    const rows = (data ?? []) as ExistingAccountRow[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/**
 * Everything `planCloudImport` needs to know about what the user ALREADY has:
 * imported provenance, categories, accounts. Read in one place so every caller
 * (the app's import, the idempotency harness) plans against the same picture.
 */
export async function fetchExistingImportState(
  supabase: SupabaseClient,
  userId: string
): Promise<Required<Pick<CloudPlanOptions,
  'existingBySourceId' | 'existingCategories' | 'existingAccounts' | 'existingTransactionLinks'>>> {
  const imported = await fetchImportedTransactions(supabase, userId);
  return {
    existingBySourceId: new Map([...imported].map(([sourceId, row]) => [sourceId, row.id])),
    existingTransactionLinks: imported,
    existingCategories: await fetchExistingCategories(supabase, userId),
    existingAccounts: await fetchExistingAccounts(supabase, userId),
  };
}

/**
 * The tables a wipe empties, in the order it must empty them.
 *
 * Not a preference — the database enforces it. accounts goes BEFORE categories
 * because the protect_transfer_category trigger only lets a To/From category go
 * once its account row has gone, and splits go before transactions because they
 * hang off them. Bank-account links cascade away with their accounts.
 *
 * Bank CONNECTIONS are not in this list and never were — but they are no longer
 * kept: `DataServiceImpl.wipeAllFinancialData` revokes them after this pass, on
 * the API path that also withdraws consent at the bank. Keeping them here made
 * "Delete All Data" quietly untrue, because the next sync recreated the very
 * accounts this list had just deleted.
 */
export const WIPE_TABLE_ORDER: readonly string[] = [
  'transaction_splits', 'transactions', 'budgets', 'goals', 'accounts', 'categories',
];

/**
 * Rows touched per statement.
 *
 * The number exists because of a real failure: "Delete All Data" issued
 * `DELETE FROM transactions WHERE user_id = …` against 51,000 rows and the
 * database gave up with `canceling statement due to statement timeout`. The
 * damage was not the error — it was WHERE it stopped. The unlink pass and the
 * splits delete had already committed, so the login was left with its transfer
 * links nulled and its splits gone and every transaction still there: a state
 * nothing in the app produces and nothing in the app expects.
 *
 * 2,000 keeps each statement to a fraction of a second on the largest real
 * dataset while keeping the number of round trips sane (26 for 51k rows). It is
 * also below PostgREST's own 1,000-row read cap doubled, so the SELECT that
 * feeds each DELETE is one request.
 */
export const WIPE_CHUNK_SIZE = 2000;

/**
 * Ids per REQUEST — a different limit, from a different failure.
 *
 * The same 51,343-row account, chunked exactly as above, then answered
 * `Failed while clearing transactions: Bad Request`. Nothing had timed out.
 * PostgREST puts an `in` list in the QUERY STRING — `?id=in.(uuid,uuid,…)` —
 * and a chunk of 2,000 UUIDs encodes to 78,071 bytes of request line, so the
 * edge refused it with a 400 before Postgres ever saw a statement. Chunking had
 * made each statement small and each URL enormous.
 *
 * 150 ids encode to 5,921 bytes against a Supabase project URL, comfortably
 * inside the 8 KB request line the proxies in the path allow, with room to spare
 * for a longer host or a table name twice the length. 200 measures 7,871 —
 * inside the limit, and outside the point of having one.
 *
 * This bounds the WRITE only. The SELECT that feeds each pass filters on
 * `user_id` and is a few hundred bytes however many ids it returns, so the wipe
 * still pages at WIPE_CHUNK_SIZE and still reports progress a chunk at a time.
 * It simply spends several requests emptying each chunk.
 *
 * (The architectural alternative is a server-side wipe RPC, which carries no id
 * list at all. That surface exists and authenticates differently; this is not
 * the change that moves the wipe onto it.)
 */
export const WIPE_REQUEST_IDS = 150;

/** What a wipe is doing right now, for a caller with a progress bar. */
export interface WipeProgress {
  table: string;
  /** Rows deleted from this table so far. */
  deleted: number;
  /**
   * What this table held when the wipe started, where the count succeeded.
   * `undefined` rather than 0 when it did not: "of unknown" is honest, "0 of 0"
   * beside a running spinner is not.
   */
  total?: number;
  /** 1-based, for "3 of 7". Includes the transfer-unlink pass as step 1. */
  step: number;
  stepCount: number;
}

/**
 * The five reads and writes a wipe performs, as a PORT.
 *
 * Not "the slice of the Supabase client we use". A structural interface
 * describing the PostgREST builder chain has to be checked against
 * `SupabaseClient`'s generics at every call site, and `tsc -b` gives up on that
 * with "Type instantiation is excessively deep" — the compiler saying the
 * abstraction is drawn in the wrong place. Five verbs are also what the loop
 * below actually needs, and they are what a test can implement honestly:
 * a real in-memory store, not a fake query builder that would only prove the
 * chain was called in the order the test expected.
 */
export interface WipeStore {
  /** How many rows this user has in `table`, or undefined when it cannot be told. */
  count(table: string, userId: string): Promise<number | undefined>;
  /** Up to `limit` ids of this user's rows in `table`. */
  idsFor(table: string, userId: string, limit: number): Promise<string[]>;
  /** Up to `limit` ids of this user's transactions that still carry a transfer link. */
  linkedTransferIds(userId: string, limit: number): Promise<string[]>;
  /**
   * Null both transfer-link columns on exactly these rows, in ONE request.
   * Keeping the list short enough to BE one request is the caller's job, not
   * this verb's — see WIPE_REQUEST_IDS.
   */
  unlinkTransfers(ids: string[]): Promise<void>;
  /** Delete exactly these rows from `table`, in one request. Same bargain. */
  deleteByIds(table: string, ids: string[]): Promise<void>;
}

export interface WipeOptions {
  onProgress?: (progress: WipeProgress) => void;
  chunkSize?: number;
  /**
   * Ids per write request. Overridable for the same reason `chunkSize` is: so a
   * test can drive the batching arithmetic without shipping a different number.
   */
  idsPerRequest?: number;
  /** Overridable so a test can run the loop against a store it can inspect. */
  store?: WipeStore;
}

/**
 * The production store. The client is used INLINE and never assigned to a
 * declared interface, which is what keeps its generics out of every signature
 * in this file.
 */
export function supabaseWipeStore(supabase: SupabaseClient): WipeStore {
  const ids = (rows: { id: string }[] | null): string[] => (rows ?? []).map(row => row.id);
  return {
    async count(table, userId) {
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      // A failed count is not a failed wipe. The delete loop decides when a
      // table is empty by reading it, never by trusting this number, so the
      // only thing lost here is the denominator in "3,000 of 51,000".
      return error || count === null ? undefined : count;
    },
    async idsFor(table, userId, limit) {
      const { data, error } = await supabase
        .from(table).select('id').eq('user_id', userId).limit(limit);
      if (error) throw new Error(error.message);
      return ids(data);
    },
    async linkedTransferIds(userId, limit) {
      const { data, error } = await supabase
        .from('transactions').select('id')
        .eq('user_id', userId)
        .not('linked_transfer_id', 'is', null)
        .limit(limit);
      if (error) throw new Error(error.message);
      return ids(data);
    },
    async unlinkTransfers(rowIds) {
      const { error } = await supabase
        .from('transactions')
        .update({ linked_transfer_id: null, linked_transfer_split_id: null })
        .in('id', rowIds);
      if (error) throw new Error(error.message);
    },
    async deleteByIds(table, rowIds) {
      const { error } = await supabase.from(table).delete().in('id', rowIds);
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * Delete ALL of the user's financial data under the authenticated client, in
 * chunks small enough that no single statement can time out, sent in requests
 * short enough that the edge will carry them.
 *
 * ── WHY CHUNKED, AND THEN BATCHED ───────────────────────────────────────────
 * See WIPE_CHUNK_SIZE: one statement per table died on a real 51k-row account
 * and left the login half-wiped. Then see WIPE_REQUEST_IDS: the chunks that
 * fixed it were sent as one URL each, and 2,000 ids do not fit in a URL. Two
 * limits, two failures, and neither one implies the other — a chunk is how much
 * work a statement does, a batch is how much text a request is.
 *
 * ── WHAT A FAILURE LEAVES BEHIND ────────────────────────────────────────────
 * Chunks commit as they go, so a failure part-way through leaves the user with
 * some rows gone and some still there. That is not a state this function tries
 * to avoid — it CANNOT, without a transaction that would reintroduce the very
 * timeout it exists to dodge — so it is a state it makes safe instead: every
 * step is idempotent (deleting rows that are already gone is a no-op, and the
 * unlink pass only touches rows that still carry a link), so running it again
 * simply carries on from wherever it stopped. The dialog says so rather than
 * showing a bare error, because "run it again" is the whole recovery.
 *
 * Used by the MS Money total migration AND the Danger Zone "Delete All Data".
 */
export async function wipeCloudData(
  supabase: SupabaseClient,
  userId: string,
  options: WipeOptions = {}
): Promise<void> {
  return runWipe(options.store ?? supabaseWipeStore(supabase), userId, options);
}

/**
 * One chunk's ids, split into request-sized batches.
 *
 * This is the function that keeps the URL under 8 KB, so what matters about it
 * is what it does NOT do: it never reorders, drops or dedupes. The batches
 * concatenate back to exactly the ids handed in, which is what lets each pass
 * still clear the whole of the column it selected on — the property the loops
 * below terminate by.
 */
function requestBatches(ids: readonly string[], size: number): string[][] {
  const batches: string[][] = [];
  for (let from = 0; from < ids.length; from += size) {
    batches.push(ids.slice(from, from + size));
  }
  return batches;
}

/**
 * The wipe itself, over the port.
 *
 * Split from `wipeCloudData` so the loop can be exercised against a real
 * in-memory store rather than a stand-in for a query builder — and so that
 * nothing about chunking, ordering or resumability is expressed in terms of
 * PostgREST. The separation is also what lets the test avoid inventing a client
 * it does not have.
 */
export async function runWipe(
  store: WipeStore,
  userId: string,
  options: Omit<WipeOptions, 'store'> = {}
): Promise<void> {
  const chunkSize = Math.max(1, options.chunkSize ?? WIPE_CHUNK_SIZE);
  const idsPerRequest = Math.max(1, options.idsPerRequest ?? WIPE_REQUEST_IDS);
  const stepCount = WIPE_TABLE_ORDER.length + 1; // +1 for the unlink pass

  // ── Step 1: break the transfer links ──────────────────────────────────────
  // Self-references between transactions. They have to go before the rows do,
  // and this UPDATE touched 13,000 rows on the real dataset — big enough to
  // time out on its own, so it is chunked like everything else.
  //
  // The loop terminates because each pass clears the very column it selects on:
  // a row updated here can never be returned by the next read. Splitting a chunk
  // across several requests does not weaken that — every batch commits before
  // the next read happens, and the batches cover the chunk exactly.
  {
    const total = await store.count('transactions', userId);
    let unlinked = 0;
    options.onProgress?.({ table: 'transfer links', deleted: 0, total, step: 1, stepCount });
    for (;;) {
      let ids: string[];
      try {
        ids = await store.linkedTransferIds(userId, chunkSize);
        if (ids.length === 0) break;
        // Sequentially, not Promise.all: these are writes against the rows the
        // next read depends on, and a burst of them is how you turn a request
        // that was too long into a database that is too busy.
        for (const batch of requestBatches(ids, idsPerRequest)) {
          await store.unlinkTransfers(batch);
        }
      } catch (error) {
        throw new Error(`Failed while unlinking transfers: ${error instanceof Error ? error.message : String(error)}`);
      }
      unlinked += ids.length;
      options.onProgress?.({ table: 'transfer links', deleted: unlinked, total, step: 1, stepCount });
    }
  }

  // ── Steps 2..n: empty each table, in the order the database allows ────────
  for (const [index, table] of WIPE_TABLE_ORDER.entries()) {
    const step = index + 2;
    const total = await store.count(table, userId);
    let deleted = 0;
    options.onProgress?.({ table, deleted, total, step, stepCount });

    for (;;) {
      let ids: string[];
      try {
        ids = await store.idsFor(table, userId, chunkSize);
        if (ids.length === 0) break;
        for (const batch of requestBatches(ids, idsPerRequest)) {
          await store.deleteByIds(table, batch);
        }
      } catch (error) {
        throw new Error(`Failed while clearing ${table}: ${error instanceof Error ? error.message : String(error)}`);
      }
      deleted += ids.length;
      // Once per chunk, not once per request: the count is of rows actually
      // gone either way, and 343 events where there were 26 is a progress bar
      // that costs more than it tells.
      options.onProgress?.({ table, deleted, total, step, stepCount });
    }
  }
}

// The local-mode equivalent used to live here as `wipeLocalData`, and it did
// not work: it wrote '[]' into window.localStorage while every reader in the
// app goes through storageAdapter → encryptedStorage → IndexedDB. It cleared
// keys nothing reads, so "Clear All Data" reported success and changed nothing.
// Its test asserted on localStorage and passed for the same reason. The working
// one is wipeLocalFinancialData in services/localBackupService.

/**
 * Execute the plan against Supabase under the authenticated client.
 */
export async function importToCloud(
  result: MsMoneyImportResult,
  supabase: SupabaseClient,
  userId: string,
  newId: () => string,
  opts: ImportOptions = {}
): Promise<void> {
  const { onProgress } = opts;

  onProgress?.({ phase: 'wiping', fraction: 0.02, message: 'Backing out existing data…' });
  // The wipe is chunked, and on a 51k-row login it is minutes rather than
  // seconds — so it reports through the SAME progress channel the rest of the
  // import uses instead of sitting silently on one sentence. The first 15% of
  // the bar is the wipe; the write passes below start from there.
  await wipeCloudData(supabase, userId, {
    onProgress: ({ table, deleted, total, step, stepCount }) => {
      const within = total && total > 0 ? Math.min(1, deleted / total) : 0;
      onProgress?.({
        phase: 'wiping',
        fraction: 0.02 + 0.13 * ((step - 1 + within) / stepCount),
        message: total === undefined
          ? `Backing out existing data — ${table}: ${deleted.toLocaleString()} removed…`
          : `Backing out existing data — ${table}: ${deleted.toLocaleString()} of ${total.toLocaleString()}…`,
      });
    },
  });

  // Read the existing state AFTER the wipe: whatever survived it (a partial
  // failure, a narrower wipe) must not be inserted a second time, and the
  // categories the user still holds are what the seed's placeholder roots have
  // to resolve onto. On a clean wipe every collection here is empty, so the
  // plan is a full import that CREATES its own roots.
  //
  // NOTE: this path is the TOTAL migration — `wipeCloudData` removes every
  // transaction including bank-fed ones, so no feed rows survive for
  // `findFeedOverlap` to reconcile against and `suppressedSourceIds` stays
  // empty here. The scoped clear-and-reimport (scripts/mnyReimportPlan.mts)
  // is the path that preserves feed rows, and it supplies the suppression set.
  const existing = await fetchExistingImportState(supabase, userId);
  const plan = planCloudImport(result, userId, newId, existing);
  await executeCloudPlan(plan, supabase, opts);
}

/**
 * Write a planned import to Supabase. Separated from `importToCloud` so the
 * idempotency harness (scripts/mnyIdempotencyCheck.mts) can run the REAL write
 * path twice without the wipe in front of it — which is the only way to prove
 * the second run inserts nothing.
 *
 * Safe to run over a database that already holds part of the plan: transactions
 * go in with ON CONFLICT DO NOTHING against the provenance unique index, and a
 * plan built with `existingBySourceId` will not offer them in the first place.
 */
export async function executeCloudPlan(
  plan: CloudPlan,
  supabase: CloudWriteClient,
  opts: ImportOptions = {}
): Promise<void> {
  const { onProgress } = opts;
  const attempts = Math.max(1, opts.retry?.attempts ?? WRITE_ATTEMPTS);
  const baseDelayMs = opts.retry?.baseDelayMs ?? RETRY_BASE_MS;
  const wait = opts.retry?.sleep ?? ((ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); }));
  const fail = (stage: string, message: string): never => {
    throw new Error(`Import failed while ${stage}: ${message}`);
  };

  /**
   * Give up `is_reconciled` on a database that has not got it.
   *
   * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
   * Migrations are applied by hand here, so this build can meet a database that
   * predates 20260810200000 — and a write naming a column that does not exist
   * is refused WHOLE. Without this, a fifty-thousand-row migration would not
   * degrade, it would refuse to run at all, and the person's answer would be a
   * PostgREST error in a modal. An import must never fail over a flag.
   *
   * ── WHAT THE DEGRADED OUTCOME IS ───────────────────────────────────────────
   * Money's C and its R stop being distinguishable. Without the column there is
   * nothing to read the committed flag from, so
   * src/utils/transactionReconciliation.ts falls back to `cleared` — and
   * `cleared` now carries C as well as R (transform.ts's cs mapping). The rows
   * Money had merely MARKED therefore read as reconciled, which is the one
   * thing this import cannot keep straight on such a database, because the
   * database has nowhere to put the second state. It is degraded, not silent:
   * the warning below says exactly that, and re-importing once the migration
   * lands restores the distinction on every row.
   *
   * ── DISCOVERED ONCE ────────────────────────────────────────────────────────
   * The first refusal flips the switch for the whole run: the batch that was
   * refused goes again reduced, and every batch after it is built reduced. No
   * batch re-probes, because a hundred round trips to be told the same thing is
   * not diagnosis, it is waste. Returns false when there is nothing left to
   * give up, which is what stops a refusal about some OTHER column looping.
   */
  let reconciledUnsupported = false;
  const giveUpReconciledColumn = (): boolean => {
    if (reconciledUnsupported) return false;
    reconciledUnsupported = true;
    logger.warn(
      'MS Money import: this database has no transactions.is_reconciled column '
      + '(migration 20260810200000 is not applied), so the rows Money had only MARKED '
      + '(its C state) cannot be told apart from the ones it had reconciled, and will '
      + 'read as reconciled. Apply the migration and re-import to record both states.'
    );
    return true;
  };
  /** True when this batch names a column the database might refuse. */
  const carriesReconciled = (rows: Record<string, unknown>[]): boolean =>
    rows.some(row => RECONCILED_COLUMN in row);
  /** The batch as it must go out now — reduced once the column has been given up. */
  const shaped = (rows: Record<string, unknown>[]): Record<string, unknown>[] => {
    if (!reconciledUnsupported) return rows;
    return rows.map(row => {
      if (!(RECONCILED_COLUMN in row)) return row;
      const reduced = { ...row };
      delete reduced[RECONCILED_COLUMN];
      return reduced;
    });
  };

  /**
   * One write, retried through a transient failure and only a transient one.
   * A dropped connection mid-import used to leave the migration half-finished
   * with no way back; a constraint violation still fails on the spot, with the
   * database's own message, because trying it again could only fail again.
   */
  const write = async (
    stage: string,
    run: () => PromiseLike<WriteOutcome>,
    /**
     * Offered only by a batch that names an optional column. Returns true when
     * it has just given one up — meaning the same batch is worth sending again
     * at once — and false when there is nothing left to give up.
     */
    giveUpUnknownColumn?: () => boolean
  ): Promise<void> => {
    for (let attempt = 1; ; attempt++) {
      let outcome: WriteOutcome;
      try {
        outcome = await run();
      } catch (thrown) {
        // A transport that rejects rather than resolving (a custom fetch, an
        // aborted socket) — indistinguishable from a network drop, so treated
        // as one.
        outcome = { error: { message: thrown instanceof Error ? thrown.message : String(thrown) }, status: 0 };
      }
      if (!outcome.error) return;
      // A column this database has not got is neither a transient failure nor a
      // data error — it is an older schema. Give the column up and offer the
      // SAME batch again immediately: nothing is congested, so there is nothing
      // to back off from.
      if (isUnknownColumn(outcome.error) && giveUpUnknownColumn?.() === true) continue;
      if (!isRetryableWriteStatus(outcome.status)) fail(stage, outcome.error.message);
      if (attempt >= attempts) {
        fail(stage, `${outcome.error.message} (gave up after ${attempt} attempts)`);
      }
      await wait(baseDelayMs * 2 ** (attempt - 1));
    }
  };

  const insert = async (
    table: string, rows: Record<string, unknown>[], phase: ImportPhase,
    base: number, span: number, onConflict?: string
  ) => {
    const batches = chunk(rows);
    let done = 0;
    for (const b of batches) {
      // With a conflict target the write becomes ON CONFLICT DO NOTHING, so a
      // row the database already holds is skipped rather than duplicated.
      await write(
        `inserting ${table}`,
        () => onConflict
          ? supabase.from(table).upsert(shaped(b), { onConflict, ignoreDuplicates: true })
          : supabase.from(table).insert(shaped(b)),
        carriesReconciled(b) ? giveUpReconciledColumn : undefined
      );
      done += b.length;
      onProgress?.({ phase, fraction: base + span * (done / Math.max(rows.length, 1)),
        message: `Importing ${table.replace('_', ' ')}… ${done}/${rows.length}` });
    }
  };

  /**
   * The second pass, in BATCHES. `ignoreDuplicates: false` makes the conflict
   * clause DO UPDATE, so the row already there is updated rather than skipped —
   * the whole point, since these rows exist by now. Complete rows, because
   * Postgres evaluates NOT NULL while building the candidate tuple, before it
   * ever looks at ON CONFLICT: an id-plus-link payload is rejected outright.
   *
   * This replaces one HTTP request per link — 11,218 of them on a real Money
   * file, which is how a home connection came to drop the import halfway.
   */
  const merge = async (
    table: string, rows: Record<string, unknown>[], onConflict: string,
    stage: string, phase: ImportPhase, base: number, span: number, label: string
  ) => {
    if (rows.length === 0) return;
    onProgress?.({ phase, fraction: base, message: `${label}…` });
    let done = 0;
    for (const b of chunk(rows)) {
      await write(
        stage,
        () => supabase.from(table).upsert(shaped(b), { onConflict, ignoreDuplicates: false }),
        carriesReconciled(b) ? giveUpReconciledColumn : undefined
      );
      done += b.length;
      onProgress?.({ phase, fraction: base + span * (done / rows.length),
        message: `${label}… ${done}/${rows.length}` });
    }
  };

  await insert('accounts', plan.accounts, 'accounts', 0.05, 0.08);
  // Accounts carry no provenance columns, so the primary key is the only
  // conflict target available — and every one of these rows was just written.
  await merge('accounts', plan.accountParentRows, 'id',
    'pairing investment cash accounts', 'accounts', 0.13, 0.01, 'Pairing investment cash accounts');
  // Opt-in, and empty unless the caller asked for it (see rebaseOpeningBalances).
  await merge('accounts', plan.accountOpeningBalanceRows, 'id',
    'correcting opening balances', 'accounts', 0.14, 0.01, 'Correcting opening balances');

  await insert('categories', plan.categories, 'categories', 0.15, 0.1);
  await insert('transactions', plan.transactions, 'transactions', 0.25, 0.37, IMPORT_PROVENANCE_CONFLICT);

  // Splits BEFORE links: a split-leg pin is a foreign key into
  // transaction_splits, so the line it names has to exist first.
  await insert('transaction_splits', plan.splits, 'splits', 0.62, 0.16);

  await merge('transactions', plan.linkRows, IMPORT_PROVENANCE_CONFLICT,
    'linking transfers', 'links', 0.78, 0.16, 'Linking transfers');

  // The feed rows that took over a suppressed transfer leg. Last, because each
  // one points at rows the passes above have just written — and keyed on the
  // primary key, because a feed row carries no import provenance to conflict on.
  await merge('transactions', plan.feedPromotionRows, 'id',
    'promoting bank-feed rows into transfers', 'links', 0.94, 0.04,
    'Promoting bank-feed rows into transfers');

  onProgress?.({ phase: 'done', fraction: 1, message: 'Import complete.' });
}
