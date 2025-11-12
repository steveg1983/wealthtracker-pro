import type { Account, Transaction } from '../types';

export interface BankConnection {
  id: string;
  provider: 'plaid' | 'truelayer' | 'manual';
  institutionId: string;
  institutionName: string;
  institutionLogo?: string;
  status: 'connected' | 'error' | 'reauth_required';
  lastSync?: Date;
  accounts: string[]; // Account IDs linked to this connection
  createdAt: Date;
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

interface PlaidConfig {
  clientId?: string;
  secret?: string;
  environment?: 'sandbox' | 'development' | 'production';
  publicKey?: string;
}

interface TrueLayerConfig {
  clientId?: string;
  clientSecret?: string;
  environment?: 'sandbox' | 'live';
  redirectUri?: string;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface LocationLike {
  origin: string;
}

type Logger = Pick<Console, 'log' | 'warn' | 'error'>;

export interface BankConnectionServiceOptions {
  storage?: StorageLike | null;
  location?: LocationLike | null;
  logger?: Logger;
  now?: () => number;
  idFactory?: () => string;
}

export class BankConnectionService {
  private connections: BankConnection[] = [];
  private plaidConfig: PlaidConfig = {};
  private trueLayerConfig: TrueLayerConfig = {};
  private storage: StorageLike | null;
  private location: LocationLike | null;
  private logger: Logger;
  private nowProvider: () => number;
  private idFactory: () => string;
  
  constructor(options: BankConnectionServiceOptions = {}) {
    this.storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    this.location = options.location ?? (typeof window !== 'undefined' ? window.location : null);
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    const noop = () => {};
    this.logger = {
      log: options.logger?.log ?? (fallbackLogger?.log?.bind(fallbackLogger) ?? noop),
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? noop),
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? noop)
    };
    this.nowProvider = options.now ?? (() => Date.now());
    this.idFactory = options.idFactory ?? (() => `conn_${this.nowProvider()}`);
    this.loadConnections();
    this.loadConfig();
  }

  private getOrigin(): string {
    return this.location?.origin ?? 'http://localhost:3000';
  }

  private getNowDate(offsetMs = 0): Date {
    return new Date(this.nowProvider() + offsetMs);
  }

  /**
   * Initialize service with API credentials
   */
  initialize(config: {
    plaid?: PlaidConfig;
    trueLayer?: TrueLayerConfig;
  }) {
    if (config.plaid) {
      this.plaidConfig = config.plaid;
    }
    if (config.trueLayer) {
      this.trueLayerConfig = config.trueLayer;
    }
    this.saveConfig();
  }

  /**
   * Get available bank institutions
   */
  async getInstitutions(country: string = 'GB'): Promise<BankInstitution[]> {
    // In a real implementation, this would call the provider APIs
    // For now, return mock data
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
        id: 'revolut',
        name: 'Revolut',
        country: 'GB',
        provider: 'truelayer',
        supportsAccountDetails: true,
        supportsTransactions: true,
        supportsBalance: true
      },
      {
        id: 'monzo',
        name: 'Monzo',
        country: 'GB',
        provider: 'truelayer',
        supportsAccountDetails: true,
        supportsTransactions: true,
        supportsBalance: true
      }
    ];
  }

  /**
   * Initiate bank connection flow
   */
  async connectBank(
    institutionId: string,
    provider: 'plaid' | 'truelayer'
  ): Promise<{ url?: string; linkToken?: string }> {
    // In a real implementation, this would:
    // 1. For Plaid: Create a link token and return it
    // 2. For TrueLayer: Generate an auth URL for OAuth flow
    
    if (provider === 'truelayer') {
      // Mock TrueLayer OAuth URL
      const redirectUri = this.trueLayerConfig.redirectUri ?? `${this.getOrigin()}/auth/callback`;
      const authUrl = `https://auth.truelayer.com/?response_type=code&client_id=${
        this.trueLayerConfig.clientId || 'demo'
      }&scope=info%20accounts%20balance%20transactions&redirect_uri=${
        encodeURIComponent(redirectUri)
      }&providers=${institutionId}`;
      
      return { url: authUrl };
    } else {
      // Mock Plaid Link token
      return { linkToken: 'link-sandbox-demo-token' };
    }
  }

  /**
   * Handle OAuth callback (for TrueLayer)
   */
  async handleOAuthCallback(code: string, state?: string): Promise<BankConnection> {
    // In a real implementation, this would:
    // 1. Exchange the code for access tokens
    // 2. Fetch account information
    // 3. Create a bank connection record
    
    const createdAt = this.getNowDate();
    const expiresAt = this.getNowDate(90 * 24 * 60 * 60 * 1000);

    const connection: BankConnection = {
      id: this.idFactory(),
      provider: 'truelayer',
      institutionId: 'demo-bank',
      institutionName: 'Demo Bank',
      status: 'connected',
      lastSync: createdAt,
      accounts: [],
      createdAt,
      expiresAt
    };
    
    this.connections.push(connection);
    this.saveConnections();
    
    return connection;
  }

  /**
   * Sync accounts and transactions
   */
  async syncConnection(connectionId: string): Promise<SyncResult> {
    const connection = this.connections.find(c => c.id === connectionId);
    if (!connection) {
      return {
        success: false,
        accountsUpdated: 0,
        transactionsImported: 0,
        errors: ['Connection not found']
      };
    }

    try {
      // In a real implementation, this would:
      // 1. Call the provider API to fetch latest data
      // 2. Update account balances
      // 3. Import new transactions
      // 4. Handle duplicates and reconciliation
      
      connection.lastSync = this.getNowDate();
      connection.status = 'connected';
      this.saveConnections();
      
      return {
        success: true,
        accountsUpdated: connection.accounts.length,
        transactionsImported: 0, // Would be actual count
        errors: []
      };
    } catch (error) {
      connection.status = 'error';
      connection.error = error instanceof Error ? error.message : 'Unknown error';
      this.saveConnections();
      this.logger.error('Failed to sync bank connection:', error);
      
      return {
        success: false,
        accountsUpdated: 0,
        transactionsImported: 0,
        errors: [connection.error]
      };
    }
  }

  /**
   * Sync all connections
   */
  async syncAll(): Promise<Map<string, SyncResult>> {
    const results = new Map<string, SyncResult>();
    
    for (const connection of this.connections) {
      if (connection.status === 'connected') {
        const result = await this.syncConnection(connection.id);
        results.set(connection.id, result);
      }
    }
    
    return results;
  }

  /**
   * Disconnect a bank connection
   */
  async disconnect(connectionId: string): Promise<boolean> {
    const index = this.connections.findIndex(c => c.id === connectionId);
    if (index === -1) return false;
    
    // In a real implementation, this would also:
    // 1. Revoke access tokens
    // 2. Clean up any stored credentials
    
    this.connections.splice(index, 1);
    this.saveConnections();
    
    return true;
  }

  /**
   * Get all connections
   */
  getConnections(): BankConnection[] {
    return this.connections;
  }

  /**
   * Get connection by ID
   */
  getConnection(id: string): BankConnection | undefined {
    return this.connections.find(c => c.id === id);
  }

  /**
   * Check if any connections need reauthorization
   */
  needsReauth(): BankConnection[] {
    const now = this.nowProvider();
    return this.connections.filter(c => 
      c.status === 'reauth_required' || 
      (c.expiresAt && new Date(c.expiresAt).getTime() < now)
    );
  }

  /**
   * Map external account to internal account
   */
  linkAccount(connectionId: string, externalAccountId: string, internalAccountId: string): void {
    const connection = this.connections.find(c => c.id === connectionId);
    if (connection && !connection.accounts.includes(internalAccountId)) {
      connection.accounts.push(internalAccountId);
      this.saveConnections();
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!(
      (this.plaidConfig.clientId && this.plaidConfig.secret) ||
      (this.trueLayerConfig.clientId && this.trueLayerConfig.clientSecret)
    );
  }

  /**
   * Get configuration status
   */
  getConfigStatus(): {
    plaid: boolean;
    trueLayer: boolean;
  } {
    return {
      plaid: !!(this.plaidConfig.clientId && this.plaidConfig.secret),
      trueLayer: !!(this.trueLayerConfig.clientId && this.trueLayerConfig.clientSecret)
    };
  }

  /**
   * Load connections from localStorage
   */
  private loadConnections(): void {
    if (!this.storage) {
      this.connections = [];
      return;
    }
    try {
      const stored = this.storage.getItem('bankConnections');
      if (stored) {
        const rawConnections = JSON.parse(stored) as BankConnection[];
        this.connections = rawConnections.map(connection => ({
          ...connection,
          createdAt: connection.createdAt ? new Date(connection.createdAt) : this.getNowDate(),
          lastSync: connection.lastSync ? new Date(connection.lastSync) : undefined,
          expiresAt: connection.expiresAt ? new Date(connection.expiresAt) : undefined
        }));
      } else {
        this.connections = [];
      }
    } catch (error) {
      this.logger.error('Failed to load bank connections:', error);
      this.connections = [];
    }
  }

  /**
   * Save connections to localStorage
   */
  private saveConnections(): void {
    if (!this.storage) {
      return;
    }
    try {
      this.storage.setItem('bankConnections', JSON.stringify(this.connections));
    } catch (error) {
      this.logger.error('Failed to save bank connections:', error);
    }
  }

  /**
   * Load API configuration
   */
  private loadConfig(): void {
    if (!this.storage) {
      return;
    }
    try {
      const stored = this.storage.getItem('bankAPIConfig');
      if (stored) {
        const config = JSON.parse(stored);
        this.plaidConfig = config.plaid || {};
        this.trueLayerConfig = config.trueLayer || {};
      }
    } catch (error) {
      this.logger.error('Failed to load bank API config:', error);
    }
  }

  /**
   * Save API configuration
   */
  private saveConfig(): void {
    if (!this.storage) {
      return;
    }
    try {
      const config = {
        plaid: this.plaidConfig,
        trueLayer: this.trueLayerConfig
      };
      this.storage.setItem('bankAPIConfig', JSON.stringify(config));
    } catch (error) {
      this.logger.error('Failed to save bank API config:', error);
    }
  }
}

export const bankConnectionService = new BankConnectionService();
