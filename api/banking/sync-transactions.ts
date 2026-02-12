import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  ErrorResponse,
  SyncTransactionsRequest,
  SyncTransactionsResponse
} from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import {
  getUserTrueLayerConnection,
  markConnectionSyncFailure,
  markConnectionSyncSuccess,
  withTrueLayerAccessToken
} from '../_lib/banking-sync.js';
import type { TrueLayerTransaction } from '../_lib/truelayer.js';
import { fetchTransactions } from '../_lib/truelayer.js';

const supabase = getServiceRoleSupabase();

const createErrorResponse = (
  res: VercelResponse,
  status: number,
  error: string,
  code: string,
  details?: unknown
) => {
  const payload: ErrorResponse = { error, code };
  if (details !== undefined) {
    payload.details = details;
  }
  return res.status(status).json(payload);
};

const coerceIsoDateTime = (value: string, endOfDay: boolean): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return endOfDay
      ? `${trimmed}T23:59:59.999Z`
      : `${trimmed}T00:00:00.000Z`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

const getDateRange = (body: SyncTransactionsRequest): { from: string; to: string } => {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const defaultTo = now.toISOString();

  const from = typeof body.startDate === 'string'
    ? coerceIsoDateTime(body.startDate, false)
    : null;
  const to = typeof body.endDate === 'string'
    ? coerceIsoDateTime(body.endDate, true)
    : null;

  if (typeof body.startDate === 'string' && !from) {
    throw new Error('Invalid startDate. Use YYYY-MM-DD or ISO-8601 date.');
  }
  if (typeof body.endDate === 'string' && !to) {
    throw new Error('Invalid endDate. Use YYYY-MM-DD or ISO-8601 date.');
  }

  const resolvedFrom = from ?? defaultFrom;
  const resolvedTo = to ?? defaultTo;
  if (new Date(resolvedFrom).getTime() > new Date(resolvedTo).getTime()) {
    throw new Error('startDate must be before endDate');
  }

  return {
    from: resolvedFrom,
    to: resolvedTo
  };
};

const normalizeAmount = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Math.abs(value) * 100) / 100;
};

const toDateOnly = (timestamp?: string): string => {
  const parsed = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
};

const toExternalTransactionId = (transaction: TrueLayerTransaction): string =>
  (transaction.normalised_provider_transaction_id || transaction.transaction_id || '').trim();

const isSchemaMismatchError = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { code?: unknown; message?: unknown };
  if (candidate.code === '42703') {
    return true;
  }
  return typeof candidate.message === 'string' && candidate.message.includes('external_transaction_id');
};

const chunk = <T>(values: T[], size: number): T[][] => {
  if (values.length <= size) {
    return [values];
  }
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  try {
    const auth = await requireAuth(req);
    const body = req.body as SyncTransactionsRequest | undefined;
    if (!body || typeof body.connectionId !== 'string' || !body.connectionId.trim()) {
      return createErrorResponse(res, 400, 'connectionId is required', 'invalid_request');
    }

    const connectionId = body.connectionId.trim();
    const connection = await getUserTrueLayerConnection(supabase, auth.userId, connectionId);
    if (!connection) {
      return createErrorResponse(res, 404, 'Connection not found', 'not_found');
    }

    const dateRange = getDateRange(body);

    const linkedAccountsResult = await supabase
      .from('linked_accounts')
      .select('account_id, external_account_id')
      .eq('connection_id', connection.id);

    if (linkedAccountsResult.error) {
      throw new Error(`Failed to load linked accounts: ${linkedAccountsResult.error.message}`);
    }

    const linkedAccounts = linkedAccountsResult.data ?? [];
    if (linkedAccounts.length === 0) {
      await markConnectionSyncSuccess(supabase, connection.id);
      await supabase.from('sync_history').insert({
        connection_id: connection.id,
        sync_type: 'transactions',
        status: 'success',
        records_synced: 0,
        created_at: new Date().toISOString()
      });

      const response: SyncTransactionsResponse = {
        success: true,
        transactionsImported: 0,
        duplicatesSkipped: 0
      };
      return res.status(200).json(response);
    }

    const accountIds = Array.from(new Set(linkedAccounts.map((item) => item.account_id)));
    const accountsResult = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', auth.userId)
      .in('id', accountIds);

    if (accountsResult.error) {
      throw new Error(`Failed to load accounts: ${accountsResult.error.message}`);
    }

    const validAccountIds = new Set((accountsResult.data ?? []).map((account) => account.id));
    const mappedLinkedAccounts = linkedAccounts.filter((item) => validAccountIds.has(item.account_id));

    if (mappedLinkedAccounts.length === 0) {
      await markConnectionSyncSuccess(supabase, connection.id);
      const response: SyncTransactionsResponse = {
        success: true,
        transactionsImported: 0,
        duplicatesSkipped: 0
      };
      return res.status(200).json(response);
    }

    const fetchedTransactions = await withTrueLayerAccessToken(supabase, connection, async (accessToken) => {
      const allTransactions: Array<{
        accountId: string;
        transaction: TrueLayerTransaction;
      }> = [];

      for (const linkedAccount of mappedLinkedAccounts) {
        const transactions = await fetchTransactions(accessToken, linkedAccount.external_account_id, {
          from: dateRange.from,
          to: dateRange.to
        });
        transactions.forEach((transaction) => {
          allTransactions.push({
            accountId: linkedAccount.account_id,
            transaction
          });
        });
      }

      return allTransactions;
    });

    const prepared = fetchedTransactions
      .map(({ accountId, transaction }) => {
        const externalTransactionId = toExternalTransactionId(transaction);
        if (!externalTransactionId) {
          return null;
        }

        const amount = normalizeAmount(transaction.amount);
        const type = transaction.amount < 0 ? 'expense' : 'income';
        const description = transaction.description?.trim() || transaction.merchant_name?.trim() || 'Bank transaction';

        return {
          user_id: auth.userId,
          account_id: accountId,
          connection_id: connection.id,
          external_transaction_id: externalTransactionId,
          external_provider: 'truelayer',
          description,
          amount,
          type,
          date: toDateOnly(transaction.timestamp),
          metadata: {
            provider: 'truelayer',
            sourceAccountId: transaction.account_id,
            transactionType: transaction.transaction_type ?? null,
            merchantName: transaction.merchant_name ?? null,
            raw: {
              transaction_id: transaction.transaction_id,
              normalised_provider_transaction_id: transaction.normalised_provider_transaction_id ?? null
            }
          }
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);

    const dedupedByExternalId = new Map<string, (typeof prepared)[number]>();
    prepared.forEach((row) => {
      if (!dedupedByExternalId.has(row.external_transaction_id)) {
        dedupedByExternalId.set(row.external_transaction_id, row);
      }
    });
    const uniquePrepared = Array.from(dedupedByExternalId.values());

    const externalIds = uniquePrepared.map((row) => row.external_transaction_id);
    const existingIds = new Set<string>();
    if (externalIds.length > 0) {
      for (const idChunk of chunk(externalIds, 500)) {
        const existingResult = await supabase
          .from('transactions')
          .select('external_transaction_id')
          .eq('connection_id', connection.id)
          .in('external_transaction_id', idChunk);

        if (existingResult.error) {
          if (isSchemaMismatchError(existingResult.error)) {
            return createErrorResponse(
              res,
              500,
              'Missing required transaction deduplication columns; apply open banking enhancement migration.',
              'schema_mismatch',
              existingResult.error
            );
          }
          throw new Error(`Failed to load existing transaction IDs: ${existingResult.error.message}`);
        }

        (existingResult.data ?? []).forEach((row) => {
          if (typeof row.external_transaction_id === 'string') {
            existingIds.add(row.external_transaction_id);
          }
        });
      }
    }

    const insertCandidates = uniquePrepared.filter((row) => !existingIds.has(row.external_transaction_id));
    let insertedCount = 0;
    for (const insertChunk of chunk(insertCandidates, 200)) {
      if (insertChunk.length === 0) {
        continue;
      }
      const insertResult = await supabase
        .from('transactions')
        .insert(insertChunk)
        .select('id');

      if (insertResult.error) {
        if (isSchemaMismatchError(insertResult.error)) {
          return createErrorResponse(
            res,
            500,
            'Missing required transaction deduplication columns; apply open banking enhancement migration.',
            'schema_mismatch',
            insertResult.error
          );
        }
        throw new Error(`Failed to insert transactions: ${insertResult.error.message}`);
      }
      insertedCount += insertResult.data?.length ?? 0;
    }

    const duplicatesSkipped = prepared.length - insertedCount;

    await markConnectionSyncSuccess(supabase, connection.id);
    await supabase.from('sync_history').insert({
      connection_id: connection.id,
      sync_type: 'transactions',
      status: 'success',
      records_synced: insertedCount,
      created_at: new Date().toISOString()
    });

    const response: SyncTransactionsResponse = {
      success: true,
      transactionsImported: insertedCount,
      duplicatesSkipped
    };
    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }

    const message = error instanceof Error ? error.message : 'Unexpected error';
    const body = req.body as SyncTransactionsRequest | undefined;
    if (body?.connectionId) {
      await markConnectionSyncFailure(supabase, body.connectionId, message);
      await supabase.from('sync_history').insert({
        connection_id: body.connectionId,
        sync_type: 'transactions',
        status: 'failed',
        records_synced: 0,
        error: message.slice(0, 2000),
        created_at: new Date().toISOString()
      });
    }

    return createErrorResponse(res, 500, message, 'internal_error');
  }
}
