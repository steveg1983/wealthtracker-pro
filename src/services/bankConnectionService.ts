import type {
  ConnectionsResponse,
  CreateLinkTokenResponse,
  DisconnectResponse,
  ExchangeTokenResponse
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

type FetchLike = typeof fetch;
type Logger = Pick<Console, 'log' | 'warn' | 'error'>;
type AuthTokenProvider = () => Promise<string | null>;

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

  constructor(options: BankConnectionServiceOptions = {}) {
    this.fetcher = options.fetch ?? (typeof fetch !== 'undefined' ? fetch : null);
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
    if (!token) {
      throw new Error('Missing authentication token');
    }
    return { Authorization: `Bearer ${token}` };
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
      const message = await response.text();
      throw new Error(message || `Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
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
    _institutionId: string,
    provider: 'plaid' | 'truelayer'
  ): Promise<{ url?: string; linkToken?: string }> {
    if (provider === 'truelayer') {
      const response = await this.request<CreateLinkTokenResponse>('/api/banking/create-link-token', {
        method: 'POST',
        body: JSON.stringify({})
      });
      return { url: response.authUrl };
    }

    return { linkToken: 'plaid-not-configured' };
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

  async syncConnection(_connectionId: string): Promise<SyncResult> {
    return {
      success: false,
      accountsUpdated: 0,
      transactionsImported: 0,
      errors: ['Sync endpoints are not implemented yet']
    };
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
