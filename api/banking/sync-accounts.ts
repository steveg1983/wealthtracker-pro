import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  SyncAccountsRequest,
  SyncAccountsResponse
} from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { createErrorResponse } from '../_lib/http-error.js';
import { captureServerError, withSentry } from '../_lib/sentry.js';
import {
  getUserTrueLayerConnection,
  isReauthRequiredError,
  markConnectionNeedsReauth,
  markConnectionSyncFailure,
  markConnectionSyncSuccess,
  withTrueLayerAccessToken
} from '../_lib/banking-sync.js';
import { fetchAccountBalance, fetchAccounts, fetchCardBalance, fetchCards } from '../_lib/truelayer.js';
import {
  cardBalanceToAppBalance,
  cardDisplayName,
  cardMask
} from '../../src/services/banking/cardNormalization.js';
import { selectAdoptableAccountId, type AdoptionCandidate } from '../../src/services/banking/accountMatching.js';

const inferMask = (account: {
  account_number?: {
    number?: string;
    iban?: string;
  };
}): string | undefined => {
  const accountNumber = account.account_number?.number?.replace(/\s+/g, '');
  if (accountNumber && accountNumber.length >= 4) {
    return accountNumber.slice(-4);
  }

  const iban = account.account_number?.iban?.replace(/\s+/g, '');
  if (iban && iban.length >= 4) {
    return iban.slice(-4);
  }

  return undefined;
};

/** The provider-STABLE identifier (full sort code + account number) from the
 *  TrueLayer payload. Unlike account_id, these survive a disconnect/reconnect,
 *  so they are the key used to re-adopt an existing account (see
 *  findAdoptableAccountId). */
const extractBankIdentifiers = (account: {
  account_number?: { number?: string; sort_code?: string };
}): { accountNumber: string | null; sortCode: string | null } => ({
  accountNumber: account.account_number?.number?.trim() || null,
  sortCode: account.account_number?.sort_code?.trim() || null
});

const mapAccountType = (accountType: string | undefined): string => {
  const normalized = (accountType ?? '').toLowerCase();
  switch (normalized) {
    case 'transaction':
      return 'checking';
    case 'savings':
      return 'savings';
    case 'credit_card':
      return 'credit';
    default:
      return 'checking';
  }
};

interface SyncedTrueLayerAccount {
  externalAccountId: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  mask?: string;
  accountNumber?: string | null;
  sortCode?: string | null;
  /** 'card' → served by /data/v1/cards; 'account' → /data/v1/accounts. */
  kind: 'account' | 'card';
}

interface LinkedAccountRow {
  account_id: string;
  external_account_id: string;
}

/**
 * Reconnect-safe account recovery (audit: a disconnect→reconnect created a
 * DUPLICATE account). On a fresh connection the linked_accounts mapping is gone
 * (disconnect hard-deletes the connection, cascade-deleting its links) and
 * TrueLayer reissues account_id, so neither the per-connection link nor the
 * external id can locate the user's existing account — the sync then auto-creates
 * a duplicate. Match instead on the provider-STABLE identifier (sort code +
 * account number, normalised). Adopt ONLY a single, unambiguous, currently-
 * UNLINKED candidate, so we never hijack an account managed by another live
 * connection, never merge two real accounts that merely share a name, and never
 * touch `balance` (the caller's update path sets bank_balance only).
 */
const findAdoptableAccountId = async (
  supabase: ReturnType<typeof getServiceRoleSupabase>,
  userId: string,
  account: SyncedTrueLayerAccount
): Promise<string | null> => {
  if (!account.accountNumber || !account.sortCode) {
    return null; // bank gave no stable identifier — skip the scan entirely
  }

  // User-scoped only (never a cross-tenant scan): the user's own active accounts
  // that carry a stored account number.
  const candidatesResult = await supabase
    .from('accounts')
    .select('id, account_number, sort_code')
    .eq('user_id', userId)
    .eq('is_active', true)
    .not('account_number', 'is', null);
  if (candidatesResult.error) {
    throw new Error(`Failed to scan accounts for re-adoption: ${candidatesResult.error.message}`);
  }
  const candidates: AdoptionCandidate[] = (candidatesResult.data ?? []).map((row) => ({
    id: row.id as string,
    accountNumber: (row.account_number as string | null) ?? null,
    sortCode: (row.sort_code as string | null) ?? null
  }));
  if (candidates.length === 0) {
    return null;
  }

  // Which of those candidates are already linked to ANY connection (never adopt
  // a live-linked account). One query, scoped to the candidate ids.
  const linksResult = await supabase
    .from('linked_accounts')
    .select('account_id')
    .in('account_id', candidates.map((c) => c.id));
  if (linksResult.error) {
    throw new Error(`Failed to check existing links: ${linksResult.error.message}`);
  }
  const linkedAccountIds = new Set<string>(
    (linksResult.data ?? []).map((row) => row.account_id as string)
  );

  return selectAdoptableAccountId(candidates, linkedAccountIds, account.accountNumber, account.sortCode);
};

const persistAccountsAndLinks = async (
  supabase: ReturnType<typeof getServiceRoleSupabase>,
  userId: string,
  connection: {
    id: string;
    institution_name: string;
  },
  accounts: SyncedTrueLayerAccount[]
): Promise<void> => {
  const linkedResult = await supabase
    .from('linked_accounts')
    .select('account_id, external_account_id')
    .eq('connection_id', connection.id);

  if (linkedResult.error) {
    throw new Error(`Failed to load linked accounts: ${linkedResult.error.message}`);
  }

  const existingLinks = (linkedResult.data ?? []) as LinkedAccountRow[];
  const linkByExternalAccountId = new Map<string, LinkedAccountRow>();
  existingLinks.forEach((row) => {
    if (row.external_account_id) {
      linkByExternalAccountId.set(row.external_account_id, row);
    }
  });

  const nowIso = new Date().toISOString();
  const externalAccountIds = new Set<string>();

  for (const account of accounts) {
    externalAccountIds.add(account.externalAccountId);

    const existingLink = linkByExternalAccountId.get(account.externalAccountId);
    let accountId = existingLink?.account_id ?? null;

    // Reconnect recovery: when this external account has no link (a fresh
    // connection after a disconnect, or TrueLayer reissued the account_id),
    // re-adopt the user's existing account for the same real bank account
    // instead of auto-creating a duplicate. Routes through the update branch
    // below, which sets bank_balance only — never `balance` — so no double-count.
    if (!accountId) {
      accountId = await findAdoptableAccountId(supabase, userId, account);
    }

    // Stable bank identifiers, stored so future reconnects can re-adopt this
    // account (only overwrite when the bank actually supplied them).
    const identifierFields: Record<string, string> = {};
    if (account.accountNumber) identifierFields.account_number = account.accountNumber;
    if (account.sortCode) identifierFields.sort_code = account.sortCode;

    if (accountId) {
      // The bank's reported figure goes to bank_balance (the reconciliation
      // reference) ONLY. `balance` is ledger-authoritative — moved exclusively
      // by the atomic transaction RPCs — so overwriting it here would silently
      // discard manual entries and break balance = initial_balance + Σtxns
      // (audit finding #12). See migration 20260613090000 for the invariant.
      const updateResult = await supabase
        .from('accounts')
        .update({
          name: account.name,
          type: account.type,
          bank_balance: account.balance,
          currency: account.currency,
          institution: connection.institution_name,
          is_active: true,
          updated_at: nowIso,
          ...identifierFields
        })
        .eq('id', accountId)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();

      if (updateResult.error) {
        throw new Error(`Failed to update mapped account: ${updateResult.error.message}`);
      }

      if (!updateResult.data?.id) {
        accountId = null;
      }
    }

    if (!accountId) {
      // If linked_accounts already exist for this connection, skip auto-creating
      // new accounts for unlinked external accounts. The user should use the
      // Link Accounts modal to manually link them first.
      if (existingLinks.length > 0) {
        continue;
      }

      const insertAccountResult = await supabase
        .from('accounts')
        .insert({
          user_id: userId,
          name: account.name,
          type: account.type,
          balance: account.balance,
          bank_balance: account.balance,
          initial_balance: account.balance,
          currency: account.currency,
          institution: connection.institution_name,
          is_active: true,
          created_at: nowIso,
          updated_at: nowIso,
          ...identifierFields
        })
        .select('id')
        .single();

      if (insertAccountResult.error || !insertAccountResult.data?.id) {
        throw new Error(`Failed to create account for bank link: ${insertAccountResult.error?.message ?? 'unknown error'}`);
      }

      accountId = insertAccountResult.data.id;
    }

    const upsertLinkResult = await supabase
      .from('linked_accounts')
      .upsert(
        {
          connection_id: connection.id,
          account_id: accountId,
          external_account_id: account.externalAccountId,
          external_account_mask: account.mask ?? null,
          external_account_name: account.name,
          external_kind: account.kind
        },
        {
          onConflict: 'connection_id,external_account_id'
        }
      );

    if (upsertLinkResult.error) {
      throw new Error(`Failed to store linked account mapping: ${upsertLinkResult.error.message}`);
    }
  }

  const staleExternalAccountIds = existingLinks
    .filter((row) => !externalAccountIds.has(row.external_account_id))
    .map((row) => row.external_account_id);

  if (staleExternalAccountIds.length === 0) {
    return;
  }

  const deleteStaleLinksResult = await supabase
    .from('linked_accounts')
    .delete()
    .eq('connection_id', connection.id)
    .in('external_account_id', staleExternalAccountIds);

  if (deleteStaleLinksResult.error) {
    throw new Error(`Failed to remove stale linked accounts: ${deleteStaleLinksResult.error.message}`);
  }
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
    const body = req.body as SyncAccountsRequest | undefined;
    if (!body || typeof body.connectionId !== 'string' || !body.connectionId.trim()) {
      return createErrorResponse(res, 400, 'connectionId is required', 'invalid_request');
    }

    const connectionId = body.connectionId.trim();
    const connection = await getUserTrueLayerConnection(supabase, auth.userId, connectionId);
    if (!connection) {
      return createErrorResponse(res, 404, 'Connection not found', 'not_found');
    }

    const accounts = await withTrueLayerAccessToken(supabase, connection, async (accessToken) => {
      const truelayerAccounts = await fetchAccounts(accessToken);
      // Cards live on a separate API surface; [] when the token predates the
      // cards scope, so old bank connections sync exactly as before.
      const truelayerCards = await fetchCards(accessToken);

      const syncedAccounts = await Promise.all(
        truelayerAccounts.map(async (account): Promise<SyncedTrueLayerAccount> => {
          let balance = 0;
          try {
            const fetchedBalance = await fetchAccountBalance(accessToken, account.account_id);
            if (typeof fetchedBalance === 'number' && Number.isFinite(fetchedBalance)) {
              balance = fetchedBalance;
            }
          } catch {
            // Balance endpoint failures should not block account discovery.
          }

          const identifiers = extractBankIdentifiers(account);
          return {
            externalAccountId: account.account_id,
            name: account.display_name?.trim() || connection.institution_name,
            type: mapAccountType(account.account_type),
            balance,
            currency: account.currency || 'GBP',
            mask: inferMask(account),
            accountNumber: identifiers.accountNumber,
            sortCode: identifiers.sortCode,
            kind: 'account'
          };
        })
      );

      const syncedCards = await Promise.all(
        truelayerCards.map(async (card): Promise<SyncedTrueLayerAccount> => {
          // Card `current` = amount OWED (positive) → app liability (negative).
          let balance = 0;
          try {
            balance = cardBalanceToAppBalance(await fetchCardBalance(accessToken, card.account_id));
          } catch {
            // Balance endpoint failures should not block discovery.
          }

          return {
            externalAccountId: card.account_id,
            name: cardDisplayName(card, connection.institution_name),
            type: 'credit',
            balance,
            currency: card.currency || 'GBP',
            mask: cardMask(card.partial_card_number),
            // Cards carry no sort code / account number, so reconnect
            // re-adoption is skipped for them (see findAdoptableAccountId).
            accountNumber: null,
            sortCode: null,
            kind: 'card'
          };
        })
      );

      return [...syncedAccounts, ...syncedCards];
    });

    await persistAccountsAndLinks(supabase, auth.userId, connection, accounts);

    await markConnectionSyncSuccess(supabase, connection.id);
    await supabase.from('sync_history').insert({
      connection_id: connection.id,
      sync_type: 'accounts',
      status: 'success',
      records_synced: accounts.length,
      created_at: new Date().toISOString()
    });

    const response: SyncAccountsResponse = {
      success: true,
      accountsSynced: accounts.length,
      accounts: accounts.map((account) => ({
        id: account.externalAccountId,
        name: account.name,
        type: account.type,
        balance: account.balance,
        currency: account.currency,
        mask: account.mask
      }))
    };
    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }

    const message = error instanceof Error ? error.message : 'Unexpected error';
    // Keep the detailed message server-side; return a generic one to the client.
    console.error('[sync-accounts] sync failed', { message });
    const needsReauth = isReauthRequiredError(error);
    if (!needsReauth) {
      await captureServerError(error, { handler: 'sync-accounts' });
    }
    const body = req.body as SyncAccountsRequest | undefined;
    if (body?.connectionId) {
      const sb = getServiceRoleSupabase();
      if (needsReauth) {
        await markConnectionNeedsReauth(sb, body.connectionId, message);
      } else {
        await markConnectionSyncFailure(sb, body.connectionId, message);
      }
      await sb.from('sync_history').insert({
        connection_id: body.connectionId,
        sync_type: 'accounts',
        status: 'failed',
        records_synced: 0,
        error: message.slice(0, 2000),
        created_at: new Date().toISOString()
      });
    }

    return needsReauth
      ? createErrorResponse(res, 409, 'Bank reauthorization required', 'reauth_required')
      : createErrorResponse(res, 500, 'Account sync failed', 'internal_error');
  }
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
