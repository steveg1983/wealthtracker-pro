import type { VercelRequest, VercelResponse } from '@vercel/node';
import Decimal from 'decimal.js';
import type {
  SyncTransactionsRequest,
  SyncTransactionsResponse
} from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { createErrorResponse } from '../_lib/http-error.js';
import { captureServerError, withSentry } from '../_lib/sentry.js';
import { applyRateLimit } from '../_lib/rate-limit.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import {
  getUserBankConnection,
  isReauthRequiredError,
  markConnectionNeedsReauth,
  markConnectionSyncFailure,
  markConnectionSyncNoAccounts,
  markConnectionSyncSuccess,
  withProviderAccessToken
} from '../_lib/banking-sync.js';
import type { TrueLayerTransaction } from '../_lib/truelayer.js';
import { fetchCardTransactions, fetchTransactions } from '../_lib/truelayer.js';
import { cardAmountToAppSigned } from '../../src/services/banking/cardNormalization.js';
import { resolveIdChurn, type ExistingBankRow } from '../../src/services/banking/idChurn.js';
import { resolveTransferAdoption } from '../../src/services/banking/transferAdoption.js';
import { resolveImportedRowAdoption } from '../../src/services/banking/importedRowAdoption.js';
import { partitionOfferedRows } from '../../src/services/banking/ownerDeletions.js';
import { applyFeedRules } from '../../src/services/banking/feedRules.js';
import { stampBackfillDecision } from '../../src/services/banking/backfillStamp.js';
import { syncWindowStart } from '../../src/services/banking/syncWindow.js';

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

/**
 * The range this sync asks the provider for.
 *
 * The FROM is decided by `syncWindowStart`, which is where the PSD2 reasoning
 * lives — asking for the full ninety days on an unattended run is asking for
 * a protected resource, and a strict provider refuses the whole call.
 *
 * An explicit startDate still wins: a caller naming a range has a reason, and
 * the deliberate backfill right after a reauthorization is one.
 */
const getDateRange = (
  body: SyncTransactionsRequest,
  lastSync: string | null | undefined
): { from: string; to: string } => {
  const now = new Date();
  const defaultFrom = syncWindowStart(lastSync, now).toISOString();
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
  // Decimal, not float: `Math.round(value * 100) / 100` is the banned IEEE-754
  // rounding pattern (CLAUDE.md Rule #4). Match the client parseMoneyInput
  // contract: 2dp, HALF_UP.
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
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

async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (await applyRateLimit(req, res, { name: 'sync-transactions', limit: 6, windowMs: 60_000 })) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  let authUserId: string | null = null;
  try {
    const auth = await requireAuth(req);
    authUserId = auth.userId;
    const supabase = getServiceRoleSupabase();
    const body = req.body as SyncTransactionsRequest | undefined;
    if (!body || typeof body.connectionId !== 'string' || !body.connectionId.trim()) {
      return createErrorResponse(res, 400, 'connectionId is required', 'invalid_request');
    }

    const connectionId = body.connectionId.trim();
    const connection = await getUserBankConnection(supabase, auth.userId, connectionId);
    if (!connection) {
      return createErrorResponse(res, 404, 'Connection not found', 'not_found');
    }

    const dateRange = getDateRange(body, connection.last_sync);

    const linkedAccountsResult = await supabase
      .from('linked_accounts')
      .select('account_id, external_account_id, external_kind')
      .eq('connection_id', connection.id);

    if (linkedAccountsResult.error) {
      throw new Error(`Failed to load linked accounts: ${linkedAccountsResult.error.message}`);
    }

    const linkedAccounts = linkedAccountsResult.data ?? [];
    if (linkedAccounts.length === 0) {
      // No linked accounts: record the run but DON'T flip status to 'connected'
      // (issue #23) — that would mask a broken/needs-reauth connection as healthy.
      await markConnectionSyncNoAccounts(supabase, connection.id, auth.userId);
      await supabase.from('sync_history').insert({
        connection_id: connection.id,
        sync_type: 'transactions',
        status: 'partial',
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
      // Linked accounts exist but none map to the user's accounts: same masking
      // risk as above (issue #23) — record the run without forcing 'connected'.
      await markConnectionSyncNoAccounts(supabase, connection.id, auth.userId);
      const response: SyncTransactionsResponse = {
        success: true,
        transactionsImported: 0,
        duplicatesSkipped: 0
      };
      return res.status(200).json(response);
    }

    const fetchedTransactions = await withProviderAccessToken(supabase, connection, async (accessToken) => {
      const allTransactions: Array<{
        accountId: string;
        transaction: TrueLayerTransaction;
        isCard: boolean;
      }> = [];

      for (const linkedAccount of mappedLinkedAccounts) {
        // Cards are served by /data/v1/cards with an INVERTED sign convention
        // (positive = money out); the amounts are normalised below.
        const isCard = (linkedAccount as { external_kind?: string }).external_kind === 'card';
        const transactions = isCard
          ? await fetchCardTransactions(accessToken, linkedAccount.external_account_id, {
              from: dateRange.from,
              to: dateRange.to
            })
          : await fetchTransactions(accessToken, linkedAccount.external_account_id, {
              from: dateRange.from,
              to: dateRange.to
            });
        transactions.forEach((transaction) => {
          allTransactions.push({
            accountId: linkedAccount.account_id,
            transaction,
            isCard
          });
        });
      }

      return allTransactions;
    });

    const prepared = fetchedTransactions
      .map(({ accountId, transaction, isCard }) => {
        const externalTransactionId = toExternalTransactionId(transaction);
        if (!externalTransactionId) {
          return null;
        }

        // Cards: positive = purchase (money out) → app-negative expense.
        // Accounts: already app-signed (debits negative).
        const amount = isCard
          ? cardAmountToAppSigned(transaction.amount)
          : normalizeAmount(transaction.amount);
        const type = amount < 0 ? 'expense' : 'income';
        const description = transaction.description?.trim() || transaction.merchant_name?.trim() || 'Bank transaction';

        return {
          user_id: auth.userId,
          account_id: accountId,
          connection_id: connection.id,
          external_transaction_id: externalTransactionId,
          external_provider: connection.provider,
          description,
          amount,
          type,
          date: toDateOnly(transaction.timestamp),
          metadata: {
            provider: connection.provider,
            sourceKind: isCard ? 'card' : 'account',
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

    // ── DELETED ON PURPOSE ──────────────────────────────────────────────────
    //
    // The exact-id pass above answers "do I already have this?" by looking at
    // rows that EXIST. A row the owner deleted does not, so its id reads as
    // new and the feed re-creates it. Reported live on 28 Aug: a £8,321.54
    // card payment, deleted because the same money was already recorded as a
    // transfer from his current account, came back on the next sync and
    // credited the card twice. A delete that guarantees a return is not a
    // delete.
    //
    // The tombstones are written by a trigger on `transactions`, so this holds
    // for every delete path there is or ever will be — see migration
    // 20260828140000. Scoped by connection because an external id is unique to
    // a provider, not to the world.
    const deletedIds = new Set<string>();
    if (externalIds.length > 0) {
      for (const idChunk of chunk(externalIds, 500)) {
        const deletedResult = await supabase
          .from('deleted_feed_transactions')
          .select('external_transaction_id')
          .eq('user_id', auth.userId)
          .eq('connection_id', connection.id)
          .in('external_transaction_id', idChunk);

        if (deletedResult.error) {
          // A missing table means the migration has not been applied yet. That
          // must not take the whole sync down — the ledger is better off with
          // yesterday's known flaw than with no sync at all — but it is not
          // something to swallow either, so it is logged loudly and the run
          // continues with the old behaviour.
          if (isSchemaMismatchError(deletedResult.error)) {
            console.warn(
              '[sync-transactions] deleted_feed_transactions is missing; deleted rows may return until migration 20260828140000 is applied'
            );
            break;
          }
          throw new Error(`Failed to load deleted transaction ids: ${deletedResult.error.message}`);
        }

        (deletedResult.data ?? []).forEach((row) => {
          if (typeof row.external_transaction_id === 'string') {
            deletedIds.add(row.external_transaction_id);
          }
        });
      }
    }

    // One partition rather than three filters, because the sync's counts are a
    // claim to the owner and they have to add up — partitionOfferedRows's
    // header argues it, and its test pins the total.
    const offered = partitionOfferedRows(uniquePrepared, existingIds, deletedIds);
    const deletedByOwnerSkipped = offered.deletedByOwner.length;
    const unknownIdCandidates = offered.unseen;

    // Id churn (observed live, Aug 2026, a cheque deposit): the provider can re-issue the SAME
    // transaction under a new external id between syncs, which sails past the
    // exact-id dedup above and lands as a duplicate. An unknown id is only a
    // new transaction if no existing row in the window matches it while its
    // own id has VANISHED from this sync's feed — see resolveIdChurn's header
    // for why the vanished id is what keeps two genuine identical cheques
    // apart. Adopted rows get their id repointed in place (categorisation and
    // reconciliation survive); nothing about the money changes, so this stays
    // outside the atomic import RPC.
    let insertCandidates = unknownIdCandidates;
    let idChurnRepaired = 0;
    if (unknownIdCandidates.length > 0) {
      const windowRowsResult = await supabase
        .from('transactions')
        .select('id, external_transaction_id, account_id, date, amount, metadata')
        .eq('connection_id', connection.id)
        .eq('user_id', auth.userId)
        .gte('date', dateRange.from.slice(0, 10))
        .lte('date', dateRange.to.slice(0, 10))
        .not('external_transaction_id', 'is', null);

      if (windowRowsResult.error) {
        throw new Error(`Failed to load window transactions for churn check: ${windowRowsResult.error.message}`);
      }

      const windowRows = (windowRowsResult.data ?? []) as Array<ExistingBankRow & {
        metadata: Record<string, unknown> | null;
      }>;
      const metadataByRowId = new Map(windowRows.map((row) => [row.id, row.metadata]));
      const fetchedExternalIds = new Set(prepared.map((row) => row.external_transaction_id));
      const resolution = resolveIdChurn(unknownIdCandidates, windowRows, fetchedExternalIds);
      insertCandidates = resolution.inserts;

      for (const adoption of resolution.adoptions) {
        const previousMetadata = metadataByRowId.get(adoption.existingRowId) ?? {};
        const previousHistory = Array.isArray(previousMetadata['idChurnHistory'])
          ? previousMetadata['idChurnHistory']
          : [];
        const updateResult = await supabase
          .from('transactions')
          .update({
            external_transaction_id: adoption.candidate.external_transaction_id,
            metadata: {
              ...previousMetadata,
              idChurnHistory: [
                ...previousHistory,
                {
                  previousExternalId: adoption.previousExternalId,
                  repairedAt: new Date().toISOString()
                }
              ]
            }
          })
          .eq('id', adoption.existingRowId)
          .eq('user_id', auth.userId);

        if (updateResult.error) {
          throw new Error(`Failed to repoint churned transaction id: ${updateResult.error.message}`);
        }
        idChurnRepaired += 1;
      }
    }

    // Hand-made transfer legs (the owner pays his card and records the
    // transfer; the feed then delivers the SAME payment under a bank id, and
    // id-keyed dedup cannot see a row that has no id — all three of his
    // cards, 28 Aug). The matching leg is ADOPTED: stamped with the
    // candidate's external id AND this connection, so every future sync
    // recognises it in the exact-id pass. resolveTransferAdoption's header
    // carries the matching rules and the ambiguity-inserts stance.
    let transfersAdopted = 0;
    if (insertCandidates.length > 0) {
      const candidateAccountIds = [...new Set(insertCandidates.map((row) => row.account_id))];
      const widen = (day: string, days: number): string => {
        const d = new Date(`${day}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
      };
      const legsResult = await supabase
        .from('transactions')
        .select('id, account_id, date, amount, metadata')
        .eq('user_id', auth.userId)
        .eq('type', 'transfer')
        .is('external_transaction_id', null)
        .in('account_id', candidateAccountIds)
        .gte('date', widen(dateRange.from.slice(0, 10), -3))
        .lte('date', widen(dateRange.to.slice(0, 10), 3));
      if (legsResult.error) {
        throw new Error(`Failed to load transfer legs for adoption check: ${legsResult.error.message}`);
      }
      const legs = (legsResult.data ?? []) as Array<{
        id: string; account_id: string; date: string; amount: number;
        metadata: Record<string, unknown> | null;
      }>;
      const legMetadataById = new Map(legs.map((row) => [row.id, row.metadata]));
      const adoptionResolution = resolveTransferAdoption(insertCandidates, legs);
      insertCandidates = adoptionResolution.inserts;

      for (const adoption of adoptionResolution.adoptions) {
        const previousMetadata = legMetadataById.get(adoption.existingRowId) ?? {};
        const previousHistory = Array.isArray(previousMetadata?.['feedTransferAdoptions'])
          ? previousMetadata['feedTransferAdoptions']
          : [];
        const updateResult = await supabase
          .from('transactions')
          .update({
            external_transaction_id: adoption.candidate.external_transaction_id,
            connection_id: connection.id,
            metadata: {
              ...(previousMetadata ?? {}),
              feedTransferAdoptions: [
                ...previousHistory,
                { adoptedAt: new Date().toISOString() }
              ]
            }
          })
          .eq('id', adoption.existingRowId)
          .eq('user_id', auth.userId);
        if (updateResult.error) {
          throw new Error(`Failed to adopt transfer leg: ${updateResult.error.message}`);
        }
        transfersAdopted += 1;
      }
    }

    // Rows the owner IMPORTED before the feed existed (his partner's account,
    // 30 Aug: a year by CSV, then the feed over the same window — every
    // overlapping payment doubled). Same adoption shape as the transfer legs
    // above, for everything that is NOT a transfer: the imported row is
    // stamped with the feed's identity and the owner's categorisation
    // survives. importedRowAdoption's header carries the two rules that
    // differ — a ±1-day window, and same-day identicals pairing by count.
    let importedRowsAdopted = 0;
    if (insertCandidates.length > 0) {
      const adoptionAccountIds = [...new Set(insertCandidates.map((row) => row.account_id))];
      const widenBy = (day: string, days: number): string => {
        const d = new Date(`${day}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
      };
      const importedRowsResult = await supabase
        .from('transactions')
        .select('id, account_id, date, amount, metadata')
        .eq('user_id', auth.userId)
        .neq('type', 'transfer')
        .is('external_transaction_id', null)
        .in('account_id', adoptionAccountIds)
        .gte('date', widenBy(dateRange.from.slice(0, 10), -1))
        .lte('date', widenBy(dateRange.to.slice(0, 10), 1));
      if (importedRowsResult.error) {
        throw new Error(`Failed to load imported rows for adoption check: ${importedRowsResult.error.message}`);
      }
      const importedRows = (importedRowsResult.data ?? []) as Array<{
        id: string; account_id: string; date: string; amount: number;
        metadata: Record<string, unknown> | null;
      }>;
      const importedMetadataById = new Map(importedRows.map((row) => [row.id, row.metadata]));
      const importedResolution = resolveImportedRowAdoption(insertCandidates, importedRows);
      insertCandidates = importedResolution.inserts;

      for (const adoption of importedResolution.adoptions) {
        const previousMetadata = importedMetadataById.get(adoption.existingRowId) ?? {};
        const previousHistory = Array.isArray(previousMetadata?.['importedRowAdoptions'])
          ? previousMetadata['importedRowAdoptions']
          : [];
        const updateResult = await supabase
          .from('transactions')
          .update({
            external_transaction_id: adoption.candidate.external_transaction_id,
            connection_id: connection.id,
            metadata: {
              ...(previousMetadata ?? {}),
              importedRowAdoptions: [
                ...previousHistory,
                { adoptedAt: new Date().toISOString() }
              ]
            }
          })
          .eq('id', adoption.existingRowId)
          .eq('user_id', auth.userId);
        if (updateResult.error) {
          throw new Error(`Failed to adopt imported row: ${updateResult.error.message}`);
        }
        importedRowsAdopted += 1;
      }
    }

    // ── THE OWNER'S RULES, ON A FEED ────────────────────────────────────────
    //
    // He asked on 28 Aug whether import rules apply to automatic bank imports.
    // They did not — the engine lived inside a service that read rules from a
    // browser, so no server could run one. Rules now live in the account and
    // the engine is shared, so the same rule that categorises a CSV row
    // categorises this one.
    //
    // Applied to INSERTS only. An adopted or duplicate row is already in the
    // ledger with whatever the owner has since made of it, and re-running a
    // rule over it would overwrite his own corrections on every sync.
    //
    // `skip` and `setAccount` are dropped before the engine sees them —
    // feedRules' header carries his ruling and the reasoning.
    let rulesApplied = 0;
    if (insertCandidates.length > 0) {
      const rulesResult = await supabase
        .from('import_rules')
        .select('id, name, enabled, priority, conditions, actions')
        .eq('user_id', auth.userId)
        .eq('enabled', true)
        .order('priority', { ascending: true });

      if (rulesResult.error) {
        // Rules are an enhancement, not a precondition. A sync that cannot
        // read them should still deliver the money — uncategorised is a state
        // the register already knows how to show, and a missed sync is not.
        console.warn('[sync-transactions] could not read import rules', rulesResult.error.message);
      } else if ((rulesResult.data ?? []).length > 0) {
        const rules = (rulesResult.data ?? []) as unknown as Parameters<typeof applyFeedRules>[1];
        insertCandidates = insertCandidates.map(row => {
          const { row: ruled, changed } = applyFeedRules(row, rules);
          if (changed) rulesApplied += 1;
          return ruled;
        });
      }
    }

    // ── THE BACKFILL VERDICT, ONCE FOR THE WHOLE SYNC ───────────────────────
    //
    // The RPC below is called per 200-row chunk, and when a row does not say,
    // it decides backfill-vs-incremental from the table per CALL. On a first
    // sync larger than one chunk that answer flips after chunk 1 — its own
    // rows make the account "already fed" — and the balance drifts by every
    // later chunk's sum (20260829170000 tells the whole story). This handler
    // is the only party that sees every chunk, so the table's question is
    // asked here, once per account, before anything is sent, and the verdict
    // rides on each row. It is the SAME question the RPC would ask, asked
    // before any chunk has muddied it — which is also why it runs after the
    // transfer adoptions above: an adopted row is feed history, exactly as
    // the first chunk's self-decide would have seen it.
    const candidateAccountIds = Array.from(
      new Set(insertCandidates.map((row) => row.account_id))
    );
    const accountsWithFeedHistory = new Set<string>();
    for (const accountId of candidateAccountIds) {
      const historyResult = await supabase
        .from('transactions')
        .select('id')
        .eq('account_id', accountId)
        .not('external_transaction_id', 'is', null)
        .limit(1);
      if (historyResult.error) {
        throw new Error(
          `Failed to read feed history for the backfill decision: ${historyResult.error.message}`
        );
      }
      if ((historyResult.data ?? []).length > 0) {
        accountsWithFeedHistory.add(accountId);
      }
    }
    const stampedCandidates = stampBackfillDecision(insertCandidates, accountsWithFeedHistory);

    let insertedCount = 0;
    for (const insertChunk of chunk(stampedCandidates, 200)) {
      if (insertChunk.length === 0) {
        continue;
      }
      // Atomic import RPC (audit finding #2/#13): each chunk's inserts, the
      // account balance effect, and the financial_audit_log rows commit in ONE
      // database transaction — bank imports can no longer create money without
      // moving the ledger balance or leaving an audit trail. Every row carries
      // the sync-wide backfill verdict stamped above; the RPC honours it over
      // its own per-call look at the table, and re-dedupes account-scoped as a
      // race backstop.
      const importResult = await supabase.rpc('import_bank_transactions_atomic', {
        p_user_id: auth.userId,
        p_rows: insertChunk
      });

      if (importResult.error) {
        if (/could not find the function/i.test(importResult.error.message ?? '')) {
          console.error('[sync-transactions] import RPC missing', {
            message: importResult.error.message
          });
          return createErrorResponse(
            res,
            500,
            'Atomic import RPC missing; apply the bank_sync_atomic_import migration.',
            'schema_mismatch'
          );
        }
        if (isSchemaMismatchError(importResult.error)) {
          // Log the raw driver error server-side for diagnosis; never return the
          // Supabase error object to the client (it exposes internal schema).
          console.error('[sync-transactions] schema mismatch on import', {
            code: importResult.error.code,
            message: importResult.error.message
          });
          return createErrorResponse(
            res,
            500,
            'Missing required transaction deduplication columns; apply open banking enhancement migration.',
            'schema_mismatch'
          );
        }
        throw new Error(`Failed to import transactions: ${importResult.error.message}`);
      }

      const summary = importResult.data as { inserted?: number } | null;
      insertedCount += summary?.inserted ?? 0;
    }

    // Adopted rows are neither imports nor duplicates — they are the same
    // transaction keeping its ledger row, so they leave both other counts.
    // Rows the owner deleted are neither imports nor duplicates: they are a
    // decision being honoured, and they leave the duplicate count alone so the
    // three numbers still add up to what the bank offered.
    const duplicatesSkipped =
      prepared.length - insertedCount - idChurnRepaired - transfersAdopted -
      importedRowsAdopted - deletedByOwnerSkipped;

    await markConnectionSyncSuccess(supabase, connection.id, auth.userId);
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
      duplicatesSkipped,
      ...(idChurnRepaired > 0 ? { idChurnRepaired } : {}),
      ...(transfersAdopted > 0 ? { transfersAdopted } : {}),
      ...(importedRowsAdopted > 0 ? { importedRowsAdopted } : {}),
      ...(deletedByOwnerSkipped > 0 ? { deletedByOwnerSkipped } : {}),
      ...(rulesApplied > 0 ? { rulesApplied } : {})
    };
    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }

    const message = error instanceof Error ? error.message : 'Unexpected error';
    // The detailed message can carry DB/driver internals — keep it server-side
    // (console + sync_history audit) and return a generic message to the client.
    console.error('[sync-transactions] sync failed', { message });

    // A needs-reauth failure (expired/invalid refresh token) is unrecoverable
    // without the user re-linking: persist 'reauth_required' so the UI shows its
    // Reauthorize CTA instead of a Sync button that will always fail (#21/#22).
    const body = req.body as SyncTransactionsRequest | undefined;
    // OWNERSHIP FIRST, THEN CLASSIFY — because the ROW is what says
    // which provider's vocabulary this error is written in, and
    // asking without it silently fell back to a generic guess. That
    // is exactly how a `403 SCA exemption has expired` — the one
    // error that most needs the Reconnect button — was filed as an
    // ordinary sync failure, leaving the row looking healthy.
    const sb = getServiceRoleSupabase();
    const ownedConnection = body?.connectionId && authUserId
      ? await getUserBankConnection(sb, authUserId, body.connectionId.trim())
      : null;
    const needsReauth = isReauthRequiredError(error, ownedConnection ?? undefined);
    // needs-reauth is an expected user-action state, not a system fault — only
    // report genuine failures.
    if (!needsReauth) {
      await captureServerError(error, { handler: 'sync-transactions' });
    }
    // body.connectionId is client-supplied and the service-role client
    // bypasses RLS — re-validate ownership before persisting any failure
    // state, or one user could flip another's connection to error/reauth.
    if (ownedConnection && authUserId) {
      if (needsReauth) {
        await markConnectionNeedsReauth(sb, ownedConnection.id, authUserId, message);
      } else {
        await markConnectionSyncFailure(sb, ownedConnection.id, authUserId, message);
      }
      await sb.from('sync_history').insert({
        connection_id: ownedConnection.id,
        sync_type: 'transactions',
        status: 'failed',
        records_synced: 0,
        error: message.slice(0, 2000),
        created_at: new Date().toISOString()
      });
    }

    return needsReauth
      ? createErrorResponse(res, 409, 'Bank reauthorization required', 'reauth_required')
      : createErrorResponse(res, 500, 'Transaction sync failed', 'internal_error');
  }
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
