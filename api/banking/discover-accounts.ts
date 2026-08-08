import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  DiscoverAccountsRequest,
  DiscoverAccountsResponse,
  DiscoveredBankAccount
} from '../../src/types/banking-api.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { createErrorResponse } from '../_lib/http-error.js';
import {
  getUserTrueLayerConnection,
  withTrueLayerAccessToken
} from '../_lib/banking-sync.js';
import { fetchAccountBalance, fetchAccounts, fetchCardBalance, fetchCards } from '../_lib/truelayer.js';
import {
  cardDisplayName,
  cardMask
} from '../../src/services/banking/cardNormalization.js';
import {
  accountBalanceSnapshot,
  balanceForDisplay,
  cardBalanceSnapshot,
  resolveBalanceSnapshot
} from '../../src/services/banking/bankBalanceSnapshot.js';
import { withSentry } from '../_lib/sentry.js';

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
    const body = req.body as DiscoverAccountsRequest | undefined;
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
      // Credit cards live on a separate API surface. fetchCards returns []
      // when the connection's token lacks the cards scope (pre-cards links).
      const truelayerCards = await fetchCards(accessToken);

      const discoveredAccounts = await Promise.all(
        truelayerAccounts.map(async (account): Promise<DiscoveredBankAccount> => {
          // Retried, then reported as it is. A failure used to leave this at 0,
          // which the link modal displayed as "£0.00" beside the user's real
          // account and prefilled into the new-account form — so a momentary
          // blip could talk someone into opening their account at nothing.
          // null travels instead, and the modal says the balance is unknown.
          const balance = await resolveBalanceSnapshot(
            () => fetchAccountBalance(accessToken, account.account_id),
            accountBalanceSnapshot
          );

          const accountNumber = account.account_number?.number?.replace(/\s+/g, '');
          const iban = account.account_number?.iban?.replace(/\s+/g, '');
          const mask = accountNumber && accountNumber.length >= 4
            ? accountNumber.slice(-4)
            : iban && iban.length >= 4
              ? iban.slice(-4)
              : undefined;

          const type = mapAccountType(account.account_type);
          // For a card on this surface account_number.number is the card number.
          // It must not leave the server: the client renders this value, prefills
          // it into the add-account form and posts it back to be stored. The mask
          // is the whole of what the app ever matches a card on.
          const isCard = type === 'credit';

          return {
            externalAccountId: account.account_id,
            name: account.display_name?.trim() || connection.institution_name,
            type,
            balance: balanceForDisplay(balance),
            currency: account.currency || 'GBP',
            sortCode: isCard ? undefined : (account.account_number?.sort_code ?? undefined),
            accountNumber: isCard ? undefined : (accountNumber ?? undefined),
            mask,
            kind: 'account'
          };
        })
      );

      const discoveredCards = await Promise.all(
        truelayerCards.map(async (card): Promise<DiscoveredBankAccount> => {
          // Card `current` = amount OWED (positive) → app liability (negative).
          // Unknown stays unknown: a card issuer that does not answer is not a
          // card with nothing owed on it.
          const balance = await resolveBalanceSnapshot(
            () => fetchCardBalance(accessToken, card.account_id),
            cardBalanceSnapshot
          );

          return {
            externalAccountId: card.account_id,
            name: cardDisplayName(card, connection.institution_name),
            type: 'credit',
            balance: balanceForDisplay(balance),
            currency: card.currency || 'GBP',
            mask: cardMask(card.partial_card_number),
            kind: 'card'
          };
        })
      );

      return [...discoveredAccounts, ...discoveredCards];
    });

    const response: DiscoverAccountsResponse = {
      success: true,
      accounts
    };
    return res.status(200).json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }

    const message = error instanceof Error ? error.message : 'Unexpected error';
    return createErrorResponse(res, 500, message, 'internal_error');
  }
}

// Safety net: report any unhandled throw to Sentry (no-op without SENTRY_DSN).
export default withSentry(handler);
