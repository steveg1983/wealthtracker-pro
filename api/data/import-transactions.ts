import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { withSentry } from '../_lib/sentry.js';

// One request = one atomic RPC = one DB transaction. The client chunks large
// imports into requests of this size; keep it well under Vercel's body limit.
const MAX_ROWS = 2000;
const ALLOWED_TYPES = new Set(['income', 'expense', 'transfer']);

// Bounds on the import id pair, matching import_transactions_atomic's own
// guards. The unique index is a btree, so an unbounded id fails deep inside the
// insert instead of here where the message can name the problem.
const MAX_IMPORT_SOURCE_LENGTH = 60;
const MAX_IMPORT_SOURCE_ID_LENGTH = 200;

interface ErrorResponse {
  error: string;
  code: string;
}

interface ImportRow {
  date?: unknown;
  description?: unknown;
  amount?: unknown;
  type?: unknown;
  category?: unknown;
  notes?: unknown;
  tags?: unknown;
  is_cleared?: unknown;
  is_recurring?: unknown;
  statement_sequence?: unknown;
  category_confirmed?: unknown;
  import_source?: unknown;
  import_source_id?: unknown;
}

interface ImportTransactionsRequest {
  accountId?: unknown;
  transactions?: unknown;
}

interface ImportTransactionsResponse {
  /** Rows this request wrote. */
  inserted: number;
  /**
   * Rows the database already held under the same (import_source,
   * import_source_id) and therefore refused to write twice. These rows ARE in
   * the account — a client counting them as landed is counting correctly.
   */
  skipped: number;
  /**
   * Every row of this request carried an import id, so re-posting it cannot
   * duplicate anything. False from a database without
   * 20260808140000_file_import_idempotency.sql, and false for any request that
   * sent no provenance — in both cases a client must NOT retry.
   */
  idempotent: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** The jsonb import_transactions_atomic returns, read without casting. */
const readRpcResult = (data: unknown, rowCount: number): ImportTransactionsResponse => {
  const result: Record<string, unknown> = isRecord(data) ? data : {};
  return {
    inserted: typeof result.inserted === 'number' ? result.inserted : rowCount,
    skipped: typeof result.skipped === 'number' ? result.skipped : 0,
    // Absent means the deployed function predates the migration: say no.
    idempotent: result.idempotent === true
  };
};

const createErrorResponse = (
  res: VercelResponse,
  status: number,
  error: string,
  code: string
) => {
  const payload: ErrorResponse = { error, code };
  return res.status(status).json(payload);
};

// Validate + normalise one row into the shape the RPC expects. Returns a string
// error message on the first problem, so a bad file is rejected with a clear
// 400 rather than surfacing as a raw database cast error.
const normaliseRow = (row: ImportRow, index: number): { row: Record<string, unknown> } | { error: string } => {
  const date = typeof row.date === 'string' ? row.date.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: `Row ${index}: date must be an ISO YYYY-MM-DD string` };
  }
  const description = typeof row.description === 'string' ? row.description.trim() : '';
  if (!description) {
    return { error: `Row ${index}: description is required` };
  }
  const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount);
  if (!Number.isFinite(amount)) {
    return { error: `Row ${index}: amount must be a finite number` };
  }
  const type = typeof row.type === 'string' ? row.type : '';
  if (!ALLOWED_TYPES.has(type)) {
    return { error: `Row ${index}: type must be income, expense or transfer` };
  }
  const tags = Array.isArray(row.tags)
    ? row.tags.filter((t): t is string => typeof t === 'string')
    : undefined;

  // The bank's own position for this row within its statement — the only record
  // of which of a day's transactions came first, since every row this RPC writes
  // shares one created_at (it is all one database transaction) and `date` is a
  // calendar day. Optional: a file format that states no order sends no key, and
  // the RPC's NULLIF then leaves the column NULL = "unknown", which is the truth.
  //
  // An ORDINAL, so whole and non-negative. Anything else is not a file position,
  // and is rejected rather than stored — a fabricated sequence is worse than
  // none, because the register cannot tell it from the bank's own.
  let statementSequence: number | undefined;
  if (row.statement_sequence !== undefined && row.statement_sequence !== null) {
    const sequence = typeof row.statement_sequence === 'number'
      ? row.statement_sequence
      : Number(row.statement_sequence);
    if (!Number.isInteger(sequence) || sequence < 0) {
      return { error: `Row ${index}: statement_sequence must be a non-negative whole number` };
    }
    statementSequence = sequence;
  }

  // The import id: what makes a re-posted chunk land once instead of twice.
  // Both halves or neither — a source with no id cannot be deduped and an id
  // with no source cannot be attributed, and the table's CHECK constraint says
  // the same thing less legibly. Refused here rather than trimmed into shape,
  // because a client that half-states an id has a bug worth hearing about.
  const importSource = typeof row.import_source === 'string' ? row.import_source.trim() : '';
  const importSourceId = typeof row.import_source_id === 'string' ? row.import_source_id.trim() : '';
  if ((importSource === '') !== (importSourceId === '')) {
    return { error: `Row ${index}: import_source and import_source_id must be sent together or not at all` };
  }
  if (importSource.length > MAX_IMPORT_SOURCE_LENGTH) {
    return { error: `Row ${index}: import_source must be at most ${MAX_IMPORT_SOURCE_LENGTH} characters` };
  }
  if (importSourceId.length > MAX_IMPORT_SOURCE_ID_LENGTH) {
    return { error: `Row ${index}: import_source_id must be at most ${MAX_IMPORT_SOURCE_ID_LENGTH} characters` };
  }

  return {
    row: {
      date,
      description,
      amount,
      type,
      category: typeof row.category === 'string' ? row.category : '',
      notes: typeof row.notes === 'string' ? row.notes : '',
      ...(tags && tags.length > 0 ? { tags } : {}),
      is_cleared: row.is_cleared === true,
      is_recurring: row.is_recurring === true,
      // Safe to send at any schema version: import_transactions_atomic reads the
      // keys it knows by name, so a database that has not yet had
      // 20260808090000_transaction_statement_sequence.sql applied simply ignores
      // this one. No deploy ordering to remember in either direction.
      ...(statementSequence !== undefined ? { statement_sequence: statementSequence } : {}),
      // "The app guessed this category." Only ever honoured as FALSE: the column
      // defaults to true, so a row that says nothing is a confirmed one, and a
      // client cannot use this key to un-confirm anything by omission. Anything
      // other than a literal false is treated as "not stated" rather than
      // rejected — an unknown truthy value here means the same as silence.
      ...(row.category_confirmed === false ? { category_confirmed: false } : {}),
      // Safe to send at any schema version, exactly like statement_sequence
      // above: a database that has not had
      // 20260808140000_file_import_idempotency.sql applied ignores both keys and
      // inserts the row as it always did. The response then says
      // idempotent: false, which is the client's signal not to retry.
      ...(importSource !== '' ? { import_source: importSource, import_source_id: importSourceId } : {})
    }
  };
};

async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  try {
    const auth = await requireAuth(req);
    const supabase = getServiceRoleSupabase();
    const body = (req.body ?? {}) as ImportTransactionsRequest;

    const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : '';
    if (!accountId) {
      return createErrorResponse(res, 400, 'accountId is required', 'invalid_request');
    }

    if (!Array.isArray(body.transactions)) {
      return createErrorResponse(res, 400, 'transactions must be an array', 'invalid_request');
    }
    if (body.transactions.length === 0) {
      return createErrorResponse(res, 400, 'transactions must not be empty', 'invalid_request');
    }
    if (body.transactions.length > MAX_ROWS) {
      return createErrorResponse(res, 413, `Too many rows in one request (max ${MAX_ROWS})`, 'too_many_rows');
    }

    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < body.transactions.length; i += 1) {
      const result = normaliseRow(body.transactions[i] as ImportRow, i);
      if ('error' in result) {
        return createErrorResponse(res, 400, result.error, 'invalid_row');
      }
      rows.push(result.row);
    }

    // Two rows sharing one import id is the single way this endpoint could lose
    // money quietly: the RPC skips a key it already holds, so the second row
    // would be discarded as a duplicate of the first and REPORTED AS LANDED.
    // The RPC refuses it too — this is the same refusal, said before the
    // request crosses the wire and with the row named.
    const seenImportIds = new Map<string, number>();
    for (let i = 0; i < rows.length; i += 1) {
      const source = rows[i].import_source;
      const sourceId = rows[i].import_source_id;
      if (typeof source !== 'string' || typeof sourceId !== 'string') {
        continue;
      }
      const key = `${source} ${sourceId}`;
      const firstSeen = seenImportIds.get(key);
      if (firstSeen !== undefined) {
        return createErrorResponse(
          res,
          400,
          `Rows ${firstSeen} and ${i} share one import id, so one of them would be discarded as a duplicate`,
          'duplicate_import_id'
        );
      }
      seenImportIds.set(key, i);
    }

    // Atomic bulk insert scoped to the Clerk-verified user. account ownership is
    // re-checked inside the RPC (the service role bypasses RLS).
    const { data, error } = await supabase.rpc('import_transactions_atomic', {
      p_user_id: auth.userId,
      p_account_id: accountId,
      p_rows: rows
    });

    if (error) {
      if (error.message?.includes('account_not_found_or_not_owned')) {
        return createErrorResponse(res, 404, 'Account not found', 'not_found');
      }

      // The rows are already in the account under this import's own id.
      //
      // Belt and braces: import_transactions_atomic skips repeats row by row
      // and so cannot raise this. If some future writer does, it must not read
      // as "the import failed" — the chunk is atomic, so a key of this request
      // already existing means an earlier post of this same chunk committed.
      // 409 says "your rows are there" and the client counts them as landed.
      if (error.code === '23505' && error.message?.includes('transactions_import_source_unique')) {
        console.warn('[import-transactions] chunk already imported', { message: error.message });
        return createErrorResponse(
          res,
          409,
          'These transactions have already been imported into this account',
          'already_imported'
        );
      }

      // The RPC's own provenance guards. These describe a malformed REQUEST,
      // not a database fault: 400 so the client stops rather than retrying
      // identical bytes three times on the way to the same answer.
      if (error.message?.includes('import_provenance_')) {
        console.error('[import-transactions] malformed import provenance', { message: error.message });
        return createErrorResponse(res, 400, 'The import ids on these rows are not usable', 'invalid_import_id');
      }

      // Log internals server-side; never leak raw database errors to clients.
      console.error('[import-transactions] RPC failed', {
        code: error.code,
        message: error.message
      });
      return createErrorResponse(res, 500, 'Failed to import transactions', 'internal_error');
    }

    const response: ImportTransactionsResponse = readRpcResult(data, rows.length);
    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }
    console.error('[import-transactions] Unexpected error', error);
    return createErrorResponse(res, 500, 'Unexpected error', 'internal_error');
  }
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
