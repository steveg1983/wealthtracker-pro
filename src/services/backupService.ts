import { supabase } from './api/supabaseClient';
import { createScopedLogger } from '../loggers/scopedLogger';
import {
  supabasePreferencesTransport,
  type PreferencesDocument,
  type PreferencesTransport,
} from './preferencesService';

// ── The FORMAT, which is no longer here ─────────────────────────────────────
//
// Slice 27 lifted it into `backup/format.ts` so that a desktop bundle can read
// and write the file format without a Supabase client in its module scope — the
// obligation `localDataPort.ts`'s `BackupFormat` recorded. It is a MOVE: every
// name below is re-exported from here, so nothing that already imported one of
// them changed, and there is still exactly one implementation of the format.
export {
  BACKUP_ENTITIES,
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  CATEGORY_LEVELS,
  MAX_EXACT_MONEY,
  RESTORE_CHUNK_SIZE,
  RESTORE_STEPS,
  RestoreFailedError,
  backupFileName,
  buildBackupBundle,
  chunkRows,
  extractAccountParents,
  extractTransactionLinks,
  findUnsafeMoneyValues,
  preferenceCount,
  remapBackupIds,
  remapPreferenceIds,
  rowsForStep,
  transactionDateRange,
  validateBackupBundle,
  type AccountParentLink,
  type BackupBundle,
  type BackupEntity,
  type BackupLinks,
  type BackupRow,
  type BackupValidation,
  type BuildBundleInput,
  type CategoryLevel,
  type DanglingReference,
  type RemapResult,
  type RestoreOutcome,
  type RestoreProgress,
  type RestoreStep,
  type TransactionLink,
} from './backup/format';

import {
  BACKUP_ENTITIES,
  backupFileName,
  remapBackupIds,
  RESTORE_STEPS,
  RestoreFailedError,
  buildBackupBundle,
  chunkRows,
  rowsForStep,
  type BackupBundle,
  type BackupEntity,
  type BackupRow,
  type RestoreOutcome,
  type RestoreProgress,
} from './backup/format';


/**
 * Backup and restore — the client half of migration 20260807083000.
 *
 * The old "export everything" built its file out of React state, which is a
 * lossy picture of the database by design: the app maps a subset of columns
 * into camelCase app types, skips whole tables it has no screen for
 * (transaction_splits, investments, goal_contributions), and carried a `tags`
 * array that has no table behind it at all. A file like that cannot be poured
 * back in, and a backup you cannot restore is not a backup.
 *
 * So this module reads WHOLE ROWS (select *) and writes them out verbatim,
 * snake_case and all. That is not laziness about naming — it is the contract
 * the restore RPC depends on. restore_user_chunk hands the incoming JSON
 * straight to jsonb_populate_recordset against the table's own rowtype, so a
 * key that is missing arrives as SQL NULL. A hand-kept column map here would
 * mean every column added to the schema after today silently vanishes from
 * every backup taken after it, and nobody would find out until the day they
 * needed the file. Whole rows drift automatically; a mapping does not.
 */

const backupLogger = createScopedLogger('BackupService');

/**
 * A plain object, for the two places this half asks.
 *
 * `backup/format.ts` has a guard of the same shape and neither is a copy of the
 * other's RULE: this is `typeof x === 'object'`, which is a fact about
 * JavaScript rather than a decision about backups. Importing it across the split
 * would make a private helper part of the format's published surface to save
 * two lines.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
/**
 * recurring_transactions is the odd one out: its user_id is TEXT referencing
 * user_profiles(clerk_user_id), not users(id). Reading it with the database
 * uuid returns nothing at all — silently, which is how a table goes missing
 * from a backup without anyone noticing.
 */
const CLERK_OWNED_ENTITIES: ReadonlySet<BackupEntity> = new Set<BackupEntity>(['recurring_transactions']);
/**
 * Supabase caps a response at 1000 rows server-side, so every read here is
 * paged. A real dataset is 50k+ transactions and the loop must not assume one
 * request is enough.
 */
const PAGE_SIZE = 1000;
// ── Reading whole rows out of the database ──────────────────────────────────

type BackupClient = NonNullable<typeof supabase>;

function requireClient(client?: BackupClient | null): BackupClient {
  const resolved = client ?? supabase;
  if (!resolved) {
    throw new Error('Backup and restore need the cloud connection, and this session is running in local mode.');
  }
  return resolved;
}

/**
 * One entity, every row, whole. Ordered by id purely so paging is stable —
 * without a deterministic order the same row can appear on two pages and
 * another on none.
 */
async function fetchAllRows(
  client: BackupClient,
  entity: BackupEntity,
  ownerId: string,
  onPage?: (rowsSoFar: number) => void
): Promise<BackupRow[]> {
  const out: BackupRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(entity)
      .select('*')
      .eq('user_id', ownerId)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Could not read ${entity} for the backup: ${error.message}`);
    }
    const rows = data ?? [];
    out.push(...rows);
    onPage?.(out.length);
    if (rows.length < PAGE_SIZE) return out;
  }
}
export interface ExportProgress {
  entity: BackupEntity;
  /** 1-based, for "3 of 14". */
  entityNumber: number;
  entityCount: number;
  /** Rows read for this entity so far. */
  rows: number;
}

export interface ExportOwner {
  /** users.id — what thirteen of the fourteen tables are keyed by. */
  databaseUserId: string;
  /** user_profiles.clerk_user_id — what recurring_transactions is keyed by. */
  clerkUserId: string | null;
}

/**
 * Read every table and build the file. Progress is reported per entity and per
 * page: on a 50k-transaction dataset this is 50+ round trips, and a button that
 * sits there saying nothing for that long reads as broken.
 */
export async function collectBackupBundle(
  owner: ExportOwner,
  options: {
    onProgress?: (progress: ExportProgress) => void;
    client?: BackupClient | null;
    /** Overridable so a test can supply a document without a database. */
    preferences?: PreferencesTransport | null;
    now?: () => Date;
  } = {}
): Promise<BackupBundle> {
  const client = requireClient(options.client);
  const data: Partial<Record<BackupEntity, BackupRow[]>> = {};

  for (const [index, entity] of BACKUP_ENTITIES.entries()) {
    const report = (rows: number): void => options.onProgress?.({
      entity,
      entityNumber: index + 1,
      entityCount: BACKUP_ENTITIES.length,
      rows,
    });
    report(0);

    const ownerId = CLERK_OWNED_ENTITIES.has(entity) ? owner.clerkUserId : owner.databaseUserId;
    if (!ownerId) {
      // Only reachable for recurring_transactions with no Clerk identity in
      // hand. Say it in the file rather than pretending the table was empty.
      data[entity] = [];
      report(0);
      continue;
    }

    data[entity] = await fetchAllRows(client, entity, ownerId, report);
  }

  // Read LAST and allowed to fail without taking the file with it. A database
  // that has not had 20260809160000 applied yet has no such table, and a backup
  // of a decade of transactions must not be refused over a missing toggle — but
  // it must SAY it carries none rather than pretending the user had none.
  let preferences: PreferencesDocument | null = null;
  const transport = options.preferences ?? supabasePreferencesTransport();
  try {
    preferences = transport === null ? null : await transport.read(owner.databaseUserId);
  } catch (error) {
    backupLogger.warn('Preferences could not be read; this backup carries none', error);
  }

  const now = options.now ?? (() => new Date());
  return buildBackupBundle({
    sourceUserId: owner.databaseUserId,
    exportedAt: now().toISOString(),
    data,
    preferences,
  });
}
/**
 * Hand the file to the browser. The stringify is the one unavoidably blocking
 * moment in the export — everything before it awaits — so it happens last,
 * after the progress display has already told the user what is going on.
 */
export function downloadBackupBundle(bundle: BackupBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = backupFileName(bundle.exportedAt);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
/** bigint comes back from PostgREST as a JSON number, but never assume it. */
function asCount(value: number | string | null): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/** True when the login holds no accounts, categories or transactions. */
export async function userFinancialDataIsEmpty(
  databaseUserId: string,
  client?: BackupClient | null
): Promise<boolean> {
  const { data, error } = await requireClient(client).rpc('user_financial_data_is_empty', {
    p_user_id: databaseUserId,
  });
  if (error) {
    throw new Error(`Could not check whether this login is empty: ${error.message}`);
  }
  return data === true;
}

/**
 * Erase the login so a backup can go in. The confirmation phrase is passed
 * straight through from what the user typed — this layer never supplies it,
 * because then the user's typing would be theatre.
 */
export async function wipeUserFinancialData(
  confirmation: string,
  databaseUserId: string,
  client?: BackupClient | null
): Promise<Record<string, number>> {
  const { data, error } = await requireClient(client).rpc('wipe_user_financial_data', {
    p_confirm: confirmation,
    p_user_id: databaseUserId,
  });
  if (error) {
    throw new Error(error.message);
  }
  const counts: Record<string, number> = {};
  if (isPlainObject(data)) {
    for (const [table, value] of Object.entries(data)) {
      if (typeof value === 'number') counts[table] = value;
    }
  }
  return counts;
}

/**
 * Run the whole restore, chunk by chunk, and stop dead on the first refusal.
 *
 * Stopping is the right behaviour rather than a limitation: chunks are separate
 * transactions, so a mid-restore failure leaves the login partly populated, and
 * carrying on would pile more rows on top of an inconsistency instead of
 * leaving it where the user can see it. Recovery is wipe and retry, which is
 * safe here precisely because the login had to be empty to begin with — nothing
 * of the user's was ever at risk.
 */
export async function restoreBackupBundle(
  bundle: BackupBundle,
  databaseUserId: string,
  options: {
    onProgress?: (progress: RestoreProgress) => void;
    client?: BackupClient | null;
    preferences?: PreferencesTransport | null;
  } = {}
): Promise<RestoreOutcome> {
  const client = requireClient(options.client);
  const restored: { label: string; rows: number }[] = [];

  // Every id in the file is replaced before a single row is sent. See
  // remapBackupIds for why this happens on every restore and not just the ones
  // that would otherwise collide.
  const { bundle: remapped, danglingRefs } = remapBackupIds(bundle);

  for (const [index, step] of RESTORE_STEPS.entries()) {
    const rows = rowsForStep(remapped, step);
    const report = (rowsDone: number): void => options.onProgress?.({
      stepNumber: index + 1,
      stepCount: RESTORE_STEPS.length + 1, // +1 for the finalize pass below
      label: step.label,
      rowsDone,
      rowsTotal: rows.length,
    });
    report(0);

    let inserted = 0;
    for (const chunk of chunkRows(rows)) {
      const { data, error } = await client.rpc('restore_user_chunk', {
        p_entity: step.entity,
        p_rows: chunk,
        p_user_id: databaseUserId,
      });
      if (error) {
        throw new RestoreFailedError(step.label, error.message);
      }
      inserted += asCount(data);
      report(inserted);
    }

    restored.push({ label: step.label, rows: inserted });
  }

  options.onProgress?.({
    stepNumber: RESTORE_STEPS.length + 1,
    stepCount: RESTORE_STEPS.length + 1,
    label: 'Reconnecting transfers and nested accounts',
    rowsDone: 0,
    rowsTotal: remapped.links.account_parents.length + remapped.links.transaction_links.length,
  });

  const { data: finalized, error: finalizeError } = await client.rpc('finalize_user_restore', {
    p_links: {
      account_parents: remapped.links.account_parents,
      transaction_links: remapped.links.transaction_links,
    },
    p_user_id: databaseUserId,
  });
  if (finalizeError) {
    throw new RestoreFailedError('Reconnecting transfers and nested accounts', finalizeError.message);
  }

  // ── Preferences, LAST ─────────────────────────────────────────────────────
  // After the links are closed, because nothing financial depends on them and
  // everything about them can fail without costing the user a row. The login
  // already has a preferences document by now — the app writes one at boot — so
  // this REPLACES rather than inserts, which is also why it is not one more
  // restore_user_chunk step.
  let preferencesRestored = 0;
  let preferencesFailure: string | null = null;
  if (remapped.preferences !== null) {
    const settings = Object.keys(remapped.preferences.values).length;
    options.onProgress?.({
      stepNumber: RESTORE_STEPS.length + 1,
      stepCount: RESTORE_STEPS.length + 1,
      label: 'Preferences',
      rowsDone: 0,
      rowsTotal: settings,
    });
    const transport = options.preferences ?? supabasePreferencesTransport();
    try {
      if (transport === null) {
        throw new Error('This session has no cloud connection, so preferences could not be saved.');
      }
      await transport.write(databaseUserId, remapped.preferences);
      preferencesRestored = settings;
    } catch (error) {
      preferencesFailure = error instanceof Error ? error.message : String(error);
      backupLogger.warn('Preferences could not be restored; every financial row is in', error);
    }
  }

  const summary = isPlainObject(finalized) ? finalized : {};
  return {
    restored,
    accountsRelinked: asCount(typeof summary.accounts_relinked === 'number' ? summary.accounts_relinked : 0),
    transactionsRelinked: asCount(typeof summary.transactions_relinked === 'number' ? summary.transactions_relinked : 0),
    preferencesRestored,
    preferencesFailure,
    danglingRefs,
  };
}
