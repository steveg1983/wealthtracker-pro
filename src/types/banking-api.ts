// POST /api/banking/create-link-token
export interface CreateLinkTokenRequest {
  institutionId?: string;
  mode?: 'connect' | 'reauth';
  connectionId?: string;
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
  success: boolean;
  connectionId: string;
  institutionId: string;
  institutionName: string;
  institutionLogo?: string;
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
  institutionId: string;
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

// GET /api/banking/ops-alert-stats
export interface OpsAlertStatsRow {
  dedupeKey: string;
  eventType: string;
  lastSentAt: string | null;
  suppressedCount: number;
  updatedAt: string | null;
  isAboveThreshold: boolean;
}

export interface OpsAlertStatsSummary {
  totalSuppressed: number;
  maxSuppressedCount: number;
  mostRecentLastSentAt: string | null;
  mostRecentUpdatedAt: string | null;
  rowsAboveThreshold: number;
}

export interface OpsAlertStatsResponse {
  success: boolean;
  filters: {
    eventType: string | null;
    eventTypePrefix?: string | null;
    minSuppressed: number;
    limit: number;
    onlyAboveThreshold: boolean;
  };
  threshold: {
    enabled: boolean;
    suppressionThreshold: number | null;
    suppressionNotifyEvery: number | null;
  };
  count: number;
  summary: OpsAlertStatsSummary;
  rows: OpsAlertStatsRow[];
}

// POST /api/banking/ops-alert-test
export interface OpsAlertTestRequest {
  message?: string;
}

export interface OpsAlertTestResponse {
  success: boolean;
  eventType: string;
  delivered: boolean;
}

// POST /api/banking/dead-letter-admin
export interface DeadLetterAdminResetRequest {
  connectionId?: string;
  connectionIds?: string[];
  resetAllDeadLettered?: boolean;
  confirm?: string;
  reason?: string;
  limit?: number;
}

export interface DeadLetterAdminRow {
  connectionId: string;
  userId: string | null;
  provider: string | null;
  status: string | null;
  institutionName: string | null;
  queueAttempts: number;
  queueLastError: string | null;
  queueNextRetryAt: string | null;
  updatedAt: string | null;
}

export interface DeadLetterAdminListResponse {
  success: boolean;
  maxRetryAttempts: number;
  count: number;
  rows: DeadLetterAdminRow[];
}

export interface DeadLetterAdminResetResponse {
  success: boolean;
  maxRetryAttempts: number;
  requested: number;
  resetConnectionIds: string[];
  auditId: string;
  auditStatus: 'completed' | 'pending';
}

// GET /api/banking/dead-letter-admin-audit
export interface DeadLetterAdminAuditRow {
  id: string;
  adminUserId: string | null;
  adminClerkId: string;
  action: string;
  scope: string;
  reason: string | null;
  requestedCount: number;
  resetCount: number;
  maxRetryAttempts: number | null;
  connectionIds: string[];
  metadata: Record<string, unknown>;
  status: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DeadLetterAdminAuditSummary {
  requestedTotal: number;
  resetTotal: number;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
}

export interface DeadLetterAdminAuditResponse {
  success: boolean;
  filters: {
    status: string | null;
    scope: string | null;
    action: string | null;
    adminClerkId: string | null;
    since: string | null;
    until: string | null;
    cursor: string | null;
    limit: number;
  };
  count: number;
  summary: DeadLetterAdminAuditSummary;
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  rows: DeadLetterAdminAuditRow[];
}

export interface ErrorResponse {
  error: string;
  code: string;
  requestId?: string;
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
export type { OpsAlertStatsRow as BankingAPIOpsAlertStatsRow };
export type { OpsAlertStatsSummary as BankingAPIOpsAlertStatsSummary };
export type { OpsAlertStatsResponse as BankingAPIOpsAlertStatsResponse };
export type { OpsAlertTestRequest as BankingAPIOpsAlertTestRequest };
export type { OpsAlertTestResponse as BankingAPIOpsAlertTestResponse };
export type { DeadLetterAdminRow as BankingAPIDeadLetterAdminRow };
export type { DeadLetterAdminListResponse as BankingAPIDeadLetterAdminListResponse };
export type { DeadLetterAdminResetRequest as BankingAPIDeadLetterAdminResetRequest };
export type { DeadLetterAdminResetResponse as BankingAPIDeadLetterAdminResetResponse };
export type { DeadLetterAdminAuditRow as BankingAPIDeadLetterAdminAuditRow };
export type { DeadLetterAdminAuditSummary as BankingAPIDeadLetterAdminAuditSummary };
export type { DeadLetterAdminAuditResponse as BankingAPIDeadLetterAdminAuditResponse };
export type { ErrorResponse as BankingAPIErrorResponse };
