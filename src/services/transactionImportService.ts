import type { Transaction } from '../types';
import { createScopedLogger } from '../loggers/scopedLogger';

/**
 * Bulk transaction import client.
 *
 * File imports (QIF/CSV) used to write one row at a time from the browser,
 * un-awaited — a large statement fired thousands of concurrent writes that the
 * API rejected en masse. This posts the rows to /api/data/import-transactions in
 * awaited chunks, each of which the server inserts in a single atomic RPC.
 */

type FetchLike = typeof fetch;
type AuthTokenProvider = () => Promise<string | null> | string | null;

interface TransactionImportServiceOptions {
  fetch?: FetchLike;
  apiBaseUrl?: string;
  authTokenProvider?: AuthTokenProvider | null;
}

export interface BulkImportProgress {
  /** Rows confirmed inserted so far. */
  inserted: number;
  /** Total rows to import. */
  total: number;
}

export interface BulkImportResult {
  inserted: number;
  total: number;
  /** True when every chunk succeeded. */
  complete: boolean;
  /** Message from the first chunk that failed, if any. */
  error?: string;
}

// Must stay <= the endpoint's MAX_ROWS, and small enough to sit well under
// Vercel's request body limit (11k rows -> ~11 requests).
const CHUNK_SIZE = 1000;
const MAX_ATTEMPTS = 3;

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
}

const toIsoDate = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().split('T')[0];
};

const toRow = (t: Omit<Transaction, 'id'>): ImportRow => {
  const tags = Array.isArray(t.tags) ? t.tags.filter(tag => typeof tag === 'string' && tag.length > 0) : [];
  return {
    date: toIsoDate(t.date),
    description: t.description,
    amount: t.amount,
    type: t.type,
    category: t.category ?? '',
    notes: t.notes ?? '',
    ...(tags.length > 0 ? { tags } : {}),
    is_cleared: Boolean(t.cleared),
    is_recurring: Boolean((t as { isRecurring?: boolean }).isRecurring)
  };
};

const chunk = <T>(items: T[], size: number): T[][] => {
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

  constructor(options: TransactionImportServiceOptions = {}) {
    const defaultFetch = typeof fetch !== 'undefined' ? (fetch.bind(globalThis) as FetchLike) : null;
    this.fetcher = options.fetch ?? defaultFetch;
    const envBase = typeof import.meta !== 'undefined'
      ? (import.meta.env?.VITE_BANKING_API_BASE_URL as string | undefined)
      : undefined;
    this.apiBaseUrl = (options.apiBaseUrl ?? envBase ?? '').trim();
    this.tokenProvider = options.authTokenProvider ?? null;
  }

  setAuthTokenProvider(provider: AuthTokenProvider | null): void {
    this.tokenProvider = provider;
  }

  private resolveUrl(path: string): string {
    const base = this.apiBaseUrl.replace(/\/+$/, '');
    return base ? `${base}${path}` : path;
  }

  private async postChunk(accountId: string, rows: ImportRow[]): Promise<number> {
    if (!this.fetcher) {
      throw new Error('Fetch API is not available');
    }
    const token = this.tokenProvider ? await this.tokenProvider() : null;
    if (!token) {
      throw new Error('Missing authentication token');
    }

    const response = await this.fetcher(this.resolveUrl('/api/data/import-transactions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ accountId, transactions: rows })
    });

    if (!response.ok) {
      let message = `Import request failed (${response.status})`;
      try {
        const payload = await response.json() as { error?: string };
        if (payload?.error) {
          message = payload.error;
        }
      } catch {
        // non-JSON error body — keep the status-based message
      }
      throw new Error(message);
    }

    const payload = await response.json() as { inserted?: number };
    return typeof payload?.inserted === 'number' ? payload.inserted : rows.length;
  }

  /**
   * Import transactions into an account in awaited chunks. Each chunk is retried
   * up to MAX_ATTEMPTS on transient failure; on persistent failure the import
   * stops and reports how many rows landed (chunks that already succeeded are
   * committed server-side and are not rolled back).
   */
  async importInChunks(
    accountId: string,
    transactions: Omit<Transaction, 'id'>[],
    opts: { onProgress?: (progress: BulkImportProgress) => void } = {}
  ): Promise<BulkImportResult> {
    const total = transactions.length;
    if (total === 0) {
      return { inserted: 0, total: 0, complete: true };
    }

    const batches = chunk(transactions.map(toRow), CHUNK_SIZE);
    let inserted = 0;

    for (const batch of batches) {
      let attempt = 0;
      for (;;) {
        attempt += 1;
        try {
          inserted += await this.postChunk(accountId, batch);
          opts.onProgress?.({ inserted, total });
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Import failed';
          if (attempt >= MAX_ATTEMPTS) {
            logger.error('Chunk failed after retries; stopping import', error as Error);
            return { inserted, total, complete: false, error: message };
          }
          logger.warn(`Chunk attempt ${attempt} failed, retrying`, message);
        }
      }
    }

    return { inserted, total, complete: true };
  }
}

export const transactionImportService = new TransactionImportService();
