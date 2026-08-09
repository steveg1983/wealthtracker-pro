import type { Transaction } from '../types';
import type {
  BulkImportProgress,
  BulkImportResult,
  ImportSourceKind
} from './port/dataPort';
import { readFitId } from '../utils/statementDuplicates';
import { createScopedLogger } from '../loggers/scopedLogger';

/**
 * Bulk transaction import client — the CLOUD half of the seam's
 * `importTransactions`.
 *
 * File imports (QIF/CSV/OFX) used to write one row at a time from the browser,
 * un-awaited — a large statement fired thousands of concurrent writes that the
 * API rejected en masse. This posts the rows to /api/data/import-transactions in
 * awaited chunks, each of which the server inserts in a single atomic RPC.
 *
 * The shapes it answers with — {@link BulkImportProgress},
 * {@link BulkImportResult} and {@link ImportSourceKind} — are declared on the
 * seam rather than here, because they are the contract EVERY engine keeps, and
 * this file is one engine. The prefix rule stated on `BulkImportResult` is the
 * rule the chunk loop below is what enforces.
 */

type FetchLike = typeof fetch;
type AuthTokenProvider = () => Promise<string | null> | string | null;

interface TransactionImportServiceOptions {
  fetch?: FetchLike;
  apiBaseUrl?: string;
  authTokenProvider?: AuthTokenProvider | null;
  /** Injectable so tests do not sit through the retry backoff. */
  delay?: (ms: number) => Promise<void>;
  /** Injectable for the same reason ids are elsewhere: determinism in tests. */
  runId?: () => string;
}

// Must stay <= the endpoint's MAX_ROWS, and small enough to sit well under
// Vercel's request body limit (11k rows -> ~11 requests).
const CHUNK_SIZE = 1000;

/**
 * How many times ONE chunk may be posted.
 *
 * This was 1, and for a while that was the only safe answer. A failure is not
 * proof that nothing was written: the commonest transient failure is a TIMEOUT,
 * and a request that times out after the server has committed looks identical,
 * from the browser, to one that never arrived. Re-posting it used to insert the
 * same thousand rows a second time and move the account balance twice —
 * `import_transactions_atomic` wrote no import-provenance columns, so the unique
 * index that makes a re-import idempotent never fired on this path.
 *
 * Migration 20260808140000_file_import_idempotency.sql closes that: the RPC now
 * writes `import_source` / `import_source_id` per row and asks Postgres to skip
 * a key this user already holds, so a re-posted chunk inserts nothing and moves
 * no money. Retrying is then what it always should have been — the right answer
 * to a dropped connection.
 *
 * TWO conditions still gate it, both enforced below:
 *   1. the server must have SAID, in a response to an earlier chunk of this
 *      session, that it would refuse a repeat (`idempotent: true`). Until it
 *      has, this client behaves exactly as it did before — one post, no retry —
 *      which is what makes it correct against a database that has not had the
 *      migration applied yet;
 *   2. the failure must be a transport fault. A 4xx is the server refusing the
 *      REQUEST, and posting the identical bytes again cannot change its mind.
 */
const ATTEMPTS_PER_CHUNK = 3;

/** Waits before the 2nd and 3rd attempt. Long enough to outlast a blip. */
const RETRY_BACKOFF_MS = [500, 2000];

/**
 * Import provenance for this path (migration 20260722170000 added the columns,
 * 20260808140000 made this RPC write them).
 *
 * `import_source` says which importer wrote the row; the MS Money importer's
 * 'ms-money' is the other value in use, and the two never share a key space.
 */
const OFX_IMPORT_SOURCE = 'ofx';
const FILE_IMPORT_SOURCE = 'file-import';

/**
 * A FITID longer than this is not one we will build a key from.
 *
 * The key is `fitid:<uuid>:<FITID>` = 43 characters plus the id, and the server
 * refuses an import_source_id over 200. A pathological file must fall back to a
 * post: key and still import, rather than be rejected wholesale — the whole
 * point of this key is to make imports MORE reliable.
 */
const MAX_FITID_LENGTH = 120;

const logger = createScopedLogger('TransactionImportService');

interface ImportRow {
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string;
  notes: string;
  tags?: string[];
  is_cleared: boolean;
  is_recurring: boolean;
  /**
   * The bank's own position for this row within its statement. Omitted rather
   * than sent as null when the source has none, so a hand-built list carries no
   * key at all and the RPC's NULLIF leaves the column NULL = "unknown".
   */
  statement_sequence?: number;
  /**
   * Sent ONLY when false — "the app guessed this category, nobody has agreed".
   * The column defaults to true, so an absent key already means confirmed, and
   * a row whose category the user's own file stated needs to say nothing.
   */
  category_confirmed?: false;
  /** Always sent as a pair, or not at all. See {@link provenanceFor}. */
  import_source: string;
  import_source_id: string;
}

/** What the endpoint reports back about one chunk. */
interface ChunkOutcome {
  /** Rows this request wrote. */
  inserted: number;
  /** Rows the database already held under the same import id. */
  alreadyPresent: number;
  /**
   * Every row of that request carried an id the database would refuse a second
   * time — so re-posting it is safe. False from a database that has not had
   * 20260808140000 applied, and from any request that sent no provenance.
   */
  idempotent: boolean;
}

/**
 * A chunk that did not land, and whether posting it again could help.
 *
 * `retryable` is decided where the failure happens, never guessed at the catch
 * site: a transport fault might have committed or might not, while a 4xx is the
 * server having read the request and refused it.
 */
class ImportRequestError extends Error {
  readonly retryable: boolean;
  readonly status: number | null;
  readonly code: string | null;

  constructor(message: string, retryable: boolean, status: number | null = null, code: string | null = null) {
    super(message);
    this.name = 'ImportRequestError';
    this.retryable = retryable;
    this.status = status;
    this.code = code;
  }
}

const toIsoDate = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().split('T')[0];
};

/**
 * The statement ordinal, or undefined when this row has none.
 *
 * An ORDINAL: whole, and never negative. A fractional or negative value is not
 * a file position, and sending one would put a fabricated order in the column
 * whose entire purpose is to hold a real one — the register cannot tell an
 * invented sequence from the bank's.
 */
const toStatementSequence = (value: number | null | undefined): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;

const defaultRunId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
};

const defaultDelay = (ms: number): Promise<void> =>
  new Promise(resolve => { setTimeout(resolve, ms); });

interface ProvenanceContext {
  accountId: string;
  /** One uuid per importInChunks call. */
  runId: string;
  kind: ImportSourceKind;
}

/**
 * What this row IS, as far as the database is concerned — the pair that lets
 * Postgres refuse a second copy of it.
 *
 * TWO SHAPES, and the difference between them is the difference between knowing
 * a row's identity and guessing at it.
 *
 *   fitid:<account_id>:<FITID>
 *     The bank's own identifier for the transaction, which OFX guarantees is
 *     unique WITHIN THE ACCOUNT. Scoped by account for exactly that reason: the
 *     unique index is scoped by user, and two banks may both hand out FITID
 *     "1". This one is durable — re-import the same statement next month and
 *     the database refuses the rows it already holds, whatever the browser
 *     thinks.
 *
 *   post:<run_id>:<row_index>
 *     Everything else: QIF, CSV, and any OFX row whose FITID is unreadable. A
 *     uuid minted once per import, plus the row's index in the WHOLE file
 *     (fixed before chunking, so chunk 2 row 0 is index 1000 and can never
 *     collide with chunk 1 row 0).
 *
 * WHY THE SECOND IS NOT A CONTENT HASH. A statement may legally hold two rows
 * with the same date, the same pence and the same description — two £4.25
 * coffees on Tuesday are two payments, and the OFX modal's own review list
 * exists because that is a real thing that happens. Hash the content and the
 * database would silently discard the second one; that is a guess about
 * identity dressed up as a constraint. An index cannot collide with anything
 * but itself, so the ONLY duplicate a post: key can ever produce is the one
 * this exists to catch: the same POST arriving twice.
 *
 * What it deliberately does not give is cross-run dedupe — importing the same
 * QIF twice still offers both copies, exactly as today. That is the browser's
 * duplicate check to make, where the user can see the matches and overrule them.
 */
const provenanceFor = (
  transaction: Omit<Transaction, 'id'>,
  index: number,
  context: ProvenanceContext
): { import_source: string; import_source_id: string } => {
  if (context.kind === 'ofx') {
    const fitId = readFitId(transaction.notes);
    if (fitId && fitId.length <= MAX_FITID_LENGTH) {
      return {
        import_source: OFX_IMPORT_SOURCE,
        import_source_id: `fitid:${context.accountId}:${fitId}`
      };
    }
  }
  return {
    import_source: context.kind === 'ofx' ? OFX_IMPORT_SOURCE : FILE_IMPORT_SOURCE,
    import_source_id: `post:${context.runId}:${index}`
  };
};

const toRow = (
  t: Omit<Transaction, 'id'>,
  index: number,
  context: ProvenanceContext
): ImportRow => {
  const tags = Array.isArray(t.tags) ? t.tags.filter(tag => typeof tag === 'string' && tag.length > 0) : [];
  const sequence = toStatementSequence(t.statementSequence);
  return {
    date: toIsoDate(t.date),
    description: t.description,
    amount: t.amount,
    type: t.type,
    category: t.category ?? '',
    notes: t.notes ?? '',
    ...(tags.length > 0 ? { tags } : {}),
    is_cleared: Boolean(t.cleared),
    is_recurring: Boolean((t as { isRecurring?: boolean }).isRecurring),
    // Carried, not dropped. This is the ONLY record of which of a day's
    // transactions came first: `date` is a calendar day, and every row of an
    // imported file shares one created_at because the RPC writes them inside a
    // single database transaction. Lose it here and the register has nothing
    // left to order a day by but guesswork. See src/utils/transactionSort.ts.
    ...(sequence !== undefined ? { statement_sequence: sequence } : {}),
    // Carried for the same reason as the ordinal above: the importer knows
    // something the database cannot work out for itself. A category the smart
    // categoriser guessed must arrive marked as a guess, or it becomes
    // indistinguishable from one the user chose the moment it lands — which is
    // the whole problem this flag exists to fix. Only ever sent as false; see
    // ImportRow.
    ...(t.categoryConfirmed === false ? { category_confirmed: false as const } : {}),
    ...provenanceFor(t, index, context)
  };
};

const chunk = <T>(items: ReadonlyArray<T>, size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

export class TransactionImportService {
  private fetcher: FetchLike | null;
  private apiBaseUrl: string;
  private tokenProvider: AuthTokenProvider | null;
  private delay: (ms: number) => Promise<void>;
  private newRunId: () => string;
  /**
   * Has this server told us, in a response we actually received, that it would
   * refuse a re-posted chunk?
   *
   * The schema-version window in one field. A retry is only ever safe if the
   * database has 20260808140000 applied AND the rows we send carry provenance,
   * and the only honest source for that is the server's own answer — which
   * arrives on the first successful chunk, before any decision to retry has to
   * be made. Never assumed, and re-read from every response, so a database that
   * stops refusing repeats immediately stops us retrying.
   */
  private repeatsRefusedByServer = false;

  constructor(options: TransactionImportServiceOptions = {}) {
    const defaultFetch = typeof fetch !== 'undefined' ? (fetch.bind(globalThis) as FetchLike) : null;
    this.fetcher = options.fetch ?? defaultFetch;
    const envBase = typeof import.meta !== 'undefined'
      ? (import.meta.env?.VITE_BANKING_API_BASE_URL as string | undefined)
      : undefined;
    this.apiBaseUrl = (options.apiBaseUrl ?? envBase ?? '').trim();
    this.tokenProvider = options.authTokenProvider ?? null;
    this.delay = options.delay ?? defaultDelay;
    this.newRunId = options.runId ?? defaultRunId;
  }

  setAuthTokenProvider(provider: AuthTokenProvider | null): void {
    this.tokenProvider = provider;
  }

  private resolveUrl(path: string): string {
    const base = this.apiBaseUrl.replace(/\/+$/, '');
    return base ? `${base}${path}` : path;
  }

  private async postChunk(accountId: string, rows: ImportRow[]): Promise<ChunkOutcome> {
    if (!this.fetcher) {
      // Nothing to retry: there is no way to send anything at all.
      throw new ImportRequestError('Fetch API is not available', false);
    }
    const token = this.tokenProvider ? await this.tokenProvider() : null;
    if (!token) {
      throw new ImportRequestError('Missing authentication token', false);
    }

    let response: Response;
    try {
      response = await this.fetcher(this.resolveUrl('/api/data/import-transactions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ accountId, transactions: rows })
      });
    } catch (error) {
      // No response at all: DNS, offline, the connection dropped, the gateway
      // hung up. This is the case that used to be unrecoverable — the request
      // may have committed, and only the server-side import id can tell us.
      const message = error instanceof Error ? error.message : 'Import request failed';
      throw new ImportRequestError(message, true, null, 'network_error');
    }

    if (!response.ok) {
      let message = `Import request failed (${response.status})`;
      let code: string | null = null;
      try {
        const payload = await response.json() as { error?: string; code?: string };
        if (payload?.error) {
          message = payload.error;
        }
        if (typeof payload?.code === 'string') {
          code = payload.code;
        }
      } catch {
        // non-JSON error body — keep the status-based message
      }

      // "These rows are already in the account under this import's own id."
      // Belt and braces: the RPC skips repeats row by row and so cannot raise
      // this, but if it ever does, the chunk is atomic — a key of ours already
      // being present means an earlier post of this same chunk committed, so
      // the rows are there and reporting them missing would send the user
      // looking for transactions that are in front of them.
      if (response.status === 409 && code === 'already_imported') {
        logger.warn('Chunk was already imported; treating as landed', message);
        return { inserted: 0, alreadyPresent: rows.length, idempotent: true };
      }

      // 5xx, 408 and 429 are the server or the road to it, not the request:
      // the same bytes may well succeed in a moment. Every other 4xx is a
      // considered refusal — a bad row, a missing account, an expired token —
      // and re-posting it identically is just a slower failure.
      const retryable = response.status >= 500 || response.status === 408 || response.status === 429;
      throw new ImportRequestError(message, retryable, response.status, code);
    }

    const payload = await response.json() as {
      inserted?: number;
      skipped?: number;
      idempotent?: boolean;
    };
    return {
      inserted: typeof payload?.inserted === 'number' ? payload.inserted : rows.length,
      alreadyPresent: typeof payload?.skipped === 'number' ? payload.skipped : 0,
      // Absent means no: an older API, or a database without the migration.
      idempotent: payload?.idempotent === true
    };
  }

  /**
   * Import transactions into an account in awaited chunks, each of which the
   * server inserts in one atomic RPC.
   *
   * A chunk is posted again only when the server has already confirmed it would
   * refuse a repeat and the failure was a transport fault — see
   * ATTEMPTS_PER_CHUNK. The first chunk that fails for good STOPS the import,
   * and the result reports how many rows landed: chunks that already committed
   * are not rolled back (that is the honest answer, not a shortcoming — the
   * server has no way to un-commit them, and the caller names the remainder).
   *
   * `inserted` is therefore always a PREFIX of `transactions`: rows
   * [inserted, total) are the ones that are missing, in file order.
   */
  async importInChunks(
    accountId: string,
    transactions: ReadonlyArray<Omit<Transaction, 'id'>>,
    opts: {
      onProgress?: (progress: BulkImportProgress) => void;
      /**
       * 'ofx' when the rows carry the bank's own FITID (the OFX modal writes it
       * into `notes`), which is then what the database keys them by. Anything
       * else keys on the import run — see {@link provenanceFor}.
       */
      source?: ImportSourceKind;
    } = {}
  ): Promise<BulkImportResult> {
    const total = transactions.length;
    if (total === 0) {
      return { inserted: 0, alreadyPresent: 0, total: 0, complete: true };
    }

    const context: ProvenanceContext = {
      accountId,
      runId: this.newRunId(),
      kind: opts.source ?? 'file'
    };
    const batches = chunk(transactions.map((t, index) => toRow(t, index, context)), CHUNK_SIZE);
    let inserted = 0;
    let alreadyPresent = 0;

    for (const batch of batches) {
      let attempt = 0;
      for (;;) {
        attempt += 1;
        try {
          const outcome = await this.postChunk(accountId, batch);
          // Read from every response, so this can go false again as readily as
          // it went true.
          this.repeatsRefusedByServer = outcome.idempotent;
          inserted += outcome.inserted + outcome.alreadyPresent;
          alreadyPresent += outcome.alreadyPresent;
          opts.onProgress?.({ inserted, total });
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Import failed';
          const retryable = error instanceof ImportRequestError && error.retryable;
          // The whole safety argument, in one condition: re-post ONLY when the
          // database has told us it would refuse the duplicate. Without that,
          // this chunk may already be in the account and a second post would
          // move the balance twice.
          const mayRetry = retryable && this.repeatsRefusedByServer && attempt < ATTEMPTS_PER_CHUNK;
          if (!mayRetry) {
            logger.error('Chunk failed; stopping import', error as Error);
            return { inserted, alreadyPresent, total, complete: false, error: message };
          }
          logger.warn(`Chunk attempt ${attempt} failed, retrying`, message);
          await this.delay(RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)]);
        }
      }
    }

    return { inserted, alreadyPresent, total, complete: true };
  }
}

export const transactionImportService = new TransactionImportService();
