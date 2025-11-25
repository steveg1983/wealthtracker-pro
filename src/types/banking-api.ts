// POST /api/banking/create-link-token
export interface CreateLinkTokenRequest {
  userId: string;
}

export interface CreateLinkTokenResponse {
  authUrl: string;
  state: string;
}

// POST /api/banking/exchange-token
export interface ExchangeTokenRequest {
  code: string;
  state: string;
}

export interface ExchangeTokenResponse {
  connectionId: string;
  institutionId: string;
  institutionName: string;
  accountsCount: number;
}

// POST /api/banking/sync-accounts
export interface SyncAccountsRequest {
  connectionId: string;
}

export interface SyncAccountsResponse {
  success: boolean;
  accountsSynced: number;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    balance: number;
    currency: string;
    mask?: string;
  }>;
  error?: string;
}

// POST /api/banking/sync-transactions
export interface SyncTransactionsRequest {
  connectionId: string;
  startDate?: string;
  endDate?: string;
}

export interface SyncTransactionsResponse {
  success: boolean;
  transactionsImported: number;
  duplicatesSkipped: number;
  error?: string;
}

// POST /api/banking/disconnect
export interface DisconnectRequest {
  connectionId: string;
}

export interface DisconnectResponse {
  success: boolean;
  error?: string;
}

// GET /api/banking/connections
export interface BankConnection {
  id: string;
  provider: string;
  institutionName: string;
  institutionLogo?: string;
  status: 'connected' | 'error' | 'reauth_required';
  lastSync?: string;
  accountsCount: number;
  expiresAt?: string;
}

export type ConnectionsResponse = BankConnection[];

// POST /api/banking/webhook
export interface WebhookPayload {
  event_type: string;
  connection_id?: string;
  [key: string]: unknown;
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

// Re-export as a namespace-like object for backwards compatibility
export const BankingAPI = {
  // Type-only exports can't be in a const, so use type re-exports instead
} as const;

// Type exports under BankingAPI namespace pattern
export type { CreateLinkTokenRequest as BankingAPICreateLinkTokenRequest };
export type { CreateLinkTokenResponse as BankingAPICreateLinkTokenResponse };
export type { ExchangeTokenRequest as BankingAPIExchangeTokenRequest };
export type { ExchangeTokenResponse as BankingAPIExchangeTokenResponse };
export type { SyncAccountsRequest as BankingAPISyncAccountsRequest };
export type { SyncAccountsResponse as BankingAPISyncAccountsResponse };
export type { SyncTransactionsRequest as BankingAPISyncTransactionsRequest };
export type { SyncTransactionsResponse as BankingAPISyncTransactionsResponse };
export type { DisconnectRequest as BankingAPIDisconnectRequest };
export type { DisconnectResponse as BankingAPIDisconnectResponse };
export type { BankConnection as BankingAPIConnection };
export type { ConnectionsResponse as BankingAPIConnectionsResponse };
export type { WebhookPayload as BankingAPIWebhookPayload };
export type { ErrorResponse as BankingAPIErrorResponse };
