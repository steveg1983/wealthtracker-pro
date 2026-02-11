import type {
  DeadLetterAdminAuditResponse,
  DeadLetterAdminListResponse,
  DeadLetterAdminResetResponse,
  ConnectionsResponse,
  CreateLinkTokenRequest,
  CreateLinkTokenResponse,
  DisconnectResponse,
  ErrorResponse,
  ExchangeTokenResponse,
  OpsAlertStatsResponse,
  OpsAlertTestResponse,
  SyncAccountsResponse,
  SyncTransactionsResponse
} from '../types/banking-api';

export interface BankConnection {
  id: string;
  provider: 'plaid' | 'truelayer' | 'manual';
  institutionId: string;
  institutionName: string;
  institutionLogo?: string;
  status: 'connected' | 'error' | 'reauth_required';
  lastSync?: Date;
  accounts: string[];
  accountsCount?: number;
  createdAt?: Date;
  expiresAt?: Date;
  error?: string;
}

export interface BankInstitution {
  id: string;
  name: string;
  logo?: string;
  country: string;
  provider: 'plaid' | 'truelayer';
  supportsAccountDetails: boolean;
  supportsTransactions: boolean;
  supportsBalance: boolean;
}

export interface SyncResult {
  success: boolean;
  accountsUpdated: number;
  transactionsImported: number;
  errors: string[];
}

export interface ConnectBankOptions {
  mode?: 'connect' | 'reauth';
  connectionId?: string;
}

export interface OpsAlertStatsQuery {
  eventType?: string;
  eventTypePrefix?: string;
  minSuppressed?: number;
  limit?: number;
  onlyAboveThreshold?: boolean;
}

export interface DeadLetterAdminAuditQuery {
  status?: 'pending' | 'completed' | 'failed';
  scope?: 'single' | 'bulk' | 'all_dead_lettered';
  action?: 'reset_dead_letter';
  adminClerkId?: string;
  since?: string;
  until?: string;
  cursor?: string;
  limit?: number;
}

export interface BankingApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

type FetchLike = typeof fetch;
type Logger = Pick<Console, 'log' | 'warn' | 'error'>;
type AuthTokenProvider = () => Promise<string | null>;
const E2E_TEST_TOKEN = 'e2e-test-token';

export interface BankConnectionServiceOptions {
  fetch?: FetchLike;
  logger?: Logger;
  apiBaseUrl?: string;
  authTokenProvider?: AuthTokenProvider | null;
}

export class BankConnectionService {
  private connections: BankConnection[] = [];
  private configStatus = { plaid: false, trueLayer: false };
  private fetcher: FetchLike | null;
  private logger: Logger;
  private apiBaseUrl: string;
  private tokenProvider: AuthTokenProvider | null;
  private hasLoggedTestAuthFallback = false;

  constructor(options: BankConnectionServiceOptions = {}) {
    const defaultFetch = typeof fetch !== 'undefined'
      ? fetch.bind(globalThis) as typeof fetch
      : null;
    this.fetcher = options.fetch ?? defaultFetch;
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    const noop = () => {};
    this.logger = {
      log: options.logger?.log ?? (fallbackLogger?.log?.bind(fallbackLogger) ?? noop),
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? noop),
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? noop)
    };
    const envBase = typeof import.meta !== 'undefined'
      ? (import.meta.env?.VITE_BANKING_API_BASE_URL as string | undefined)
      : undefined;
    this.apiBaseUrl = (options.apiBaseUrl ?? envBase ?? '').trim();
    this.tokenProvider = options.authTokenProvider ?? null;
  }

  setAuthTokenProvider(provider: AuthTokenProvider | null): void {
    this.tokenProvider = provider;
  }

  setApiBaseUrl(baseUrl: string | null): void {
    this.apiBaseUrl = (baseUrl ?? '').trim();
  }

  private shouldUseE2eAuthFallback(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const e2eAuthEnabled = typeof import.meta !== 'undefined' &&
      import.meta.env?.VITE_E2E_TEST_MODE_AUTH === 'true';
    if (!e2eAuthEnabled) {
      return false;
    }

    const params = new URLSearchParams(window.location.search);
    const queryTestModeEnabled = params.get('testMode') === 'true';
    const storageTestModeEnabled = window.localStorage.getItem('isTestMode') === 'true';
    return queryTestModeEnabled || storageTestModeEnabled;
  }

  private resolveUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    const base = this.apiBaseUrl.replace(/\/+$/, '');
    if (!base) {
      return path.startsWith('/') ? path : `/${path}`;
    }
    if (path.startsWith('/')) {
      return `${base}${path}`;
    }
    return `${base}/${path}`;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = this.tokenProvider ? await this.tokenProvider() : null;
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }

    if (this.shouldUseE2eAuthFallback()) {
      if (!this.hasLoggedTestAuthFallback) {
        this.logger.warn(
          'Using VITE_E2E_TEST_MODE_AUTH fallback token for banking API requests in test mode'
        );
        this.hasLoggedTestAuthFallback = true;
      }
      return { Authorization: `Bearer ${E2E_TEST_TOKEN}` };
    }

    throw new Error('Missing authentication token');
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.fetcher) {
      throw new Error('Fetch API is not available');
    }

    const headers = new Headers(init.headers ?? {});
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const authHeaders = await this.getAuthHeaders();
    Object.entries(authHeaders).forEach(([key, value]) => headers.set(key, value));

    const response = await this.fetcher(this.resolveUrl(path), {
      ...init,
      headers
    });

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      let code: string | undefined;
      let details: unknown;
      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        try {
          const payload = (await response.json()) as Partial<ErrorResponse>;
          if (typeof payload.error === 'string' && payload.error.trim()) {
            message = payload.error;
          }
          if (typeof payload.code === 'string') {
            code = payload.code;
          }
          details = payload.details;
        } catch {
          message = await response.text();
        }
      } else {
        const text = await response.text();
        if (text.trim()) {
          message = text;
        }
      }

      const error = new Error(message) as BankingApiError;
      error.status = response.status;
      error.code = code;
      error.details = details;
      throw error;
    }

    return response.json() as Promise<T>;
  }

  private async requestText(path: string, init: RequestInit = {}): Promise<string> {
    if (!this.fetcher) {
      throw new Error('Fetch API is not available');
    }

    const headers = new Headers(init.headers ?? {});
    const authHeaders = await this.getAuthHeaders();
    Object.entries(authHeaders).forEach(([key, value]) => headers.set(key, value));

    const response = await this.fetcher(this.resolveUrl(path), {
      ...init,
      headers
    });

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      let code: string | undefined;
      let details: unknown;
      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        try {
          const payload = (await response.json()) as Partial<ErrorResponse>;
          if (typeof payload.error === 'string' && payload.error.trim()) {
            message = payload.error;
          }
          if (typeof payload.code === 'string') {
            code = payload.code;
          }
          details = payload.details;
        } catch {
          message = await response.text();
        }
      } else {
        const text = await response.text();
        if (text.trim()) {
          message = text;
        }
      }

      const error = new Error(message) as BankingApiError;
      error.status = response.status;
      error.code = code;
      error.details = details;
      throw error;
    }

    return response.text();
  }

  async getOpsAlertStats(query: OpsAlertStatsQuery = {}): Promise<OpsAlertStatsResponse> {
    const params = new URLSearchParams();

    if (typeof query.eventType === 'string' && query.eventType.trim()) {
      params.set('eventType', query.eventType.trim());
    }
    if (typeof query.eventTypePrefix === 'string' && query.eventTypePrefix.trim()) {
      params.set('eventTypePrefix', query.eventTypePrefix.trim());
    }
    if (typeof query.minSuppressed === 'number' && Number.isFinite(query.minSuppressed)) {
      params.set('minSuppressed', String(Math.max(0, Math.floor(query.minSuppressed))));
    }
    if (typeof query.limit === 'number' && Number.isFinite(query.limit)) {
      const limit = Math.min(Math.max(Math.floor(query.limit), 1), 200);
      params.set('limit', String(limit));
    }
    if (query.onlyAboveThreshold === true) {
      params.set('onlyAboveThreshold', '1');
    }

    const queryString = params.toString();
    const path = queryString
      ? `/api/banking/ops-alert-stats?${queryString}`
      : '/api/banking/ops-alert-stats';

    return this.request<OpsAlertStatsResponse>(path, { method: 'GET' });
  }

  async triggerOpsAlertTest(message?: string): Promise<OpsAlertTestResponse> {
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';
    const payload = trimmedMessage ? { message: trimmedMessage } : {};

    return this.request<OpsAlertTestResponse>('/api/banking/ops-alert-test', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async resetAllDeadLettered(
    confirm: string,
    reason: string,
    limit?: number
  ): Promise<DeadLetterAdminResetResponse> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error('Reason is required');
    }

    const payload: {
      resetAllDeadLettered: true;
      confirm: string;
      reason: string;
      limit?: number;
    } = {
      resetAllDeadLettered: true,
      confirm,
      reason: trimmedReason
    };

    if (typeof limit === 'number' && Number.isFinite(limit)) {
      payload.limit = Math.max(1, Math.floor(limit));
    }

    return this.request<DeadLetterAdminResetResponse>('/api/banking/dead-letter-admin', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async resetDeadLetterConnections(
    connectionIds: string[],
    reason: string,
    confirm?: string
  ): Promise<DeadLetterAdminResetResponse> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error('Reason is required');
    }

    const uniqueConnectionIds = Array.from(new Set(
      connectionIds
        .map((connectionId) => connectionId.trim())
        .filter(Boolean)
    )).slice(0, 200);

    if (uniqueConnectionIds.length === 0) {
      throw new Error('At least one connection is required');
    }

    const payload: {
      connectionIds: string[];
      reason: string;
      confirm?: string;
    } = {
      connectionIds: uniqueConnectionIds,
      reason: trimmedReason
    };
    const trimmedConfirm = typeof confirm === 'string' ? confirm.trim() : '';
    if (trimmedConfirm) {
      payload.confirm = trimmedConfirm;
    }

    return this.request<DeadLetterAdminResetResponse>('/api/banking/dead-letter-admin', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getDeadLetterRows(limit = 25): Promise<DeadLetterAdminListResponse> {
    const parsedLimit = Math.min(200, Math.max(1, Math.floor(limit)));
    return this.request<DeadLetterAdminListResponse>(`/api/banking/dead-letter-admin?limit=${parsedLimit}`, {
      method: 'GET'
    });
  }

  async getDeadLetterAudit(query: DeadLetterAdminAuditQuery = {}): Promise<DeadLetterAdminAuditResponse> {
    const params = new URLSearchParams();

    if (typeof query.status === 'string' && query.status.trim()) {
      params.set('status', query.status.trim());
    }
    if (typeof query.scope === 'string' && query.scope.trim()) {
      params.set('scope', query.scope.trim());
    }
    if (typeof query.action === 'string' && query.action.trim()) {
      params.set('action', query.action.trim());
    }
    if (typeof query.adminClerkId === 'string' && query.adminClerkId.trim()) {
      params.set('adminClerkId', query.adminClerkId.trim());
    }
    if (typeof query.since === 'string' && query.since.trim()) {
      params.set('since', query.since.trim());
    }
    if (typeof query.until === 'string' && query.until.trim()) {
      params.set('until', query.until.trim());
    }
    if (typeof query.cursor === 'string' && query.cursor.trim()) {
      params.set('cursor', query.cursor.trim());
    }
    if (typeof query.limit === 'number' && Number.isFinite(query.limit)) {
      const bounded = Math.min(200, Math.max(1, Math.floor(query.limit)));
      params.set('limit', String(bounded));
    }

    const queryString = params.toString();
    const path = queryString
      ? `/api/banking/dead-letter-admin-audit?${queryString}`
      : '/api/banking/dead-letter-admin-audit';

    return this.request<DeadLetterAdminAuditResponse>(path, { method: 'GET' });
  }

  async exportDeadLetterAuditCsv(query: DeadLetterAdminAuditQuery = {}): Promise<string> {
    const params = new URLSearchParams();

    if (typeof query.status === 'string' && query.status.trim()) {
      params.set('status', query.status.trim());
    }
    if (typeof query.scope === 'string' && query.scope.trim()) {
      params.set('scope', query.scope.trim());
    }
    if (typeof query.action === 'string' && query.action.trim()) {
      params.set('action', query.action.trim());
    }
    if (typeof query.adminClerkId === 'string' && query.adminClerkId.trim()) {
      params.set('adminClerkId', query.adminClerkId.trim());
    }
    if (typeof query.since === 'string' && query.since.trim()) {
      params.set('since', query.since.trim());
    }
    if (typeof query.until === 'string' && query.until.trim()) {
      params.set('until', query.until.trim());
    }
    if (typeof query.cursor === 'string' && query.cursor.trim()) {
      params.set('cursor', query.cursor.trim());
    }
    if (typeof query.limit === 'number' && Number.isFinite(query.limit)) {
      const bounded = Math.min(5000, Math.max(1, Math.floor(query.limit)));
      params.set('limit', String(bounded));
    }

    const queryString = params.toString();
    const path = queryString
      ? `/api/banking/dead-letter-admin-audit-export?${queryString}`
      : '/api/banking/dead-letter-admin-audit-export';

    return this.requestText(path, { method: 'GET' });
  }

  async refreshConnections(): Promise<BankConnection[]> {
    try {
      const data = await this.request<ConnectionsResponse>('/api/banking/connections', {
        method: 'GET'
      });

      this.connections = data.map((connection) => ({
        id: connection.id,
        provider: connection.provider as BankConnection['provider'],
        institutionId: connection.institutionId,
        institutionName: connection.institutionName,
        institutionLogo: connection.institutionLogo,
        status: connection.status,
        lastSync: connection.lastSync ? new Date(connection.lastSync) : undefined,
        accounts: [],
        accountsCount: connection.accountsCount,
        expiresAt: connection.expiresAt ? new Date(connection.expiresAt) : undefined
      }));
    } catch (error) {
      this.logger.error('Failed to load bank connections', error as Error);
      this.connections = [];
    }

    return this.connections;
  }

  getConnections(): BankConnection[] {
    return this.connections;
  }

  async refreshConfigStatus(): Promise<{ plaid: boolean; trueLayer: boolean }> {
    try {
      const data = await this.request<{ env_check?: { has_truelayer_client_id?: boolean; has_truelayer_secret?: boolean; has_redirect_uri?: boolean } }>(
        '/api/banking/health',
        { method: 'GET' }
      );

      const envCheck = data.env_check;
      const trueLayerConfigured = Boolean(
        envCheck?.has_truelayer_client_id &&
        envCheck?.has_truelayer_secret &&
        envCheck?.has_redirect_uri
      );

      this.configStatus = {
        plaid: false,
        trueLayer: trueLayerConfigured
      };
    } catch (error) {
      this.logger.warn('Failed to load banking config status', error as Error);
      this.configStatus = { plaid: false, trueLayer: false };
    }

    return this.configStatus;
  }

  getConfigStatus(): { plaid: boolean; trueLayer: boolean } {
    return this.configStatus;
  }

  async getInstitutions(_country: string = 'GB'): Promise<BankInstitution[]> {
    return [
      {
        id: 'barclays',
        name: 'Barclays',
        country: 'GB',
        provider: 'truelayer',
        supportsAccountDetails: true,
        supportsTransactions: true,
        supportsBalance: true
      },
      {
        id: 'hsbc',
        name: 'HSBC',
        country: 'GB',
        provider: 'truelayer',
        supportsAccountDetails: true,
        supportsTransactions: true,
        supportsBalance: true
      },
      {
        id: 'lloyds',
        name: 'Lloyds Bank',
        country: 'GB',
        provider: 'truelayer',
        supportsAccountDetails: true,
        supportsTransactions: true,
        supportsBalance: true
      },
      {
        id: 'natwest',
        name: 'NatWest',
        country: 'GB',
        provider: 'truelayer',
        supportsAccountDetails: true,
        supportsTransactions: true,
        supportsBalance: true
      },
      {
        id: 'chase',
        name: 'Chase',
        country: 'US',
        provider: 'plaid',
        supportsAccountDetails: true,
        supportsTransactions: true,
        supportsBalance: true
      },
      {
        id: 'bank-of-america',
        name: 'Bank of America',
        country: 'US',
        provider: 'plaid',
        supportsAccountDetails: true,
        supportsTransactions: true,
        supportsBalance: true
      }
    ];
  }

  async connectBank(
    institutionId: string,
    provider: 'plaid' | 'truelayer',
    options: ConnectBankOptions = {}
  ): Promise<{ url?: string; linkToken?: string }> {
    if (provider === 'truelayer') {
      const requestBody: CreateLinkTokenRequest = {
        institutionId,
        mode: options.mode ?? 'connect',
        connectionId: options.connectionId
      };
      const response = await this.request<CreateLinkTokenResponse>('/api/banking/create-link-token', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      return { url: response.authUrl };
    }

    return { linkToken: 'plaid-not-configured' };
  }

  async reauthorizeConnection(connectionId: string): Promise<{ url?: string; linkToken?: string }> {
    const connection = this.connections.find((item) => item.id === connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }
    if (connection.provider !== 'truelayer') {
      throw new Error('Reauthorization is currently supported only for TrueLayer connections');
    }

    return this.connectBank(connection.institutionId, 'truelayer', {
      mode: 'reauth',
      connectionId
    });
  }

  async handleOAuthCallback(code: string, state?: string): Promise<BankConnection | null> {
    if (!state) {
      throw new Error('Missing state parameter');
    }

    const response = await this.request<ExchangeTokenResponse>('/api/banking/exchange-token', {
      method: 'POST',
      body: JSON.stringify({ code, state })
    });

    await this.refreshConnections();
    return this.connections.find((connection) => connection.id === response.connectionId) ?? null;
  }

  async syncConnection(connectionId: string): Promise<SyncResult> {
    try {
      const accountsResponse = await this.request<SyncAccountsResponse>('/api/banking/sync-accounts', {
        method: 'POST',
        body: JSON.stringify({ connectionId })
      });

      const transactionsResponse = await this.request<SyncTransactionsResponse>('/api/banking/sync-transactions', {
        method: 'POST',
        body: JSON.stringify({ connectionId })
      });

      await this.refreshConnections();

      const errors: string[] = [];
      if (accountsResponse.error) {
        errors.push(accountsResponse.error);
      }
      if (transactionsResponse.error) {
        errors.push(transactionsResponse.error);
      }

      return {
        success: accountsResponse.success && transactionsResponse.success,
        accountsUpdated: accountsResponse.accountsSynced,
        transactionsImported: transactionsResponse.transactionsImported,
        errors
      };
    } catch (error) {
      this.logger.error('Failed to sync bank connection', error as Error);
      return {
        success: false,
        accountsUpdated: 0,
        transactionsImported: 0,
        errors: [error instanceof Error ? error.message : 'Unknown sync error']
      };
    }
  }

  async syncAll(): Promise<Map<string, SyncResult>> {
    const results = new Map<string, SyncResult>();
    for (const connection of this.connections) {
      results.set(connection.id, await this.syncConnection(connection.id));
    }
    return results;
  }

  async disconnect(connectionId: string): Promise<boolean> {
    await this.request<DisconnectResponse>('/api/banking/disconnect', {
      method: 'POST',
      body: JSON.stringify({ connectionId })
    });

    this.connections = this.connections.filter((connection) => connection.id !== connectionId);
    return true;
  }

  needsReauth(): BankConnection[] {
    const now = Date.now();
    return this.connections.filter((connection) =>
      connection.status === 'reauth_required' ||
      (connection.expiresAt && connection.expiresAt.getTime() < now)
    );
  }
}

export const bankConnectionService = new BankConnectionService();
