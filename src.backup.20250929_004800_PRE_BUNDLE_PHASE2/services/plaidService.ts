// Plaid Service for Open Banking Integration
// This service manages the client-side Plaid Link integration
// All sensitive operations are handled by the backend service

import type { Account, Transaction } from '../types';
import type { SavedPlaidConnection, PlaidApiParams } from '../types/plaid';
import { plaidBackendService } from './api/plaidBackendService';
import { useUser } from '@clerk/clerk-react';
import { logger } from './loggingService';

export interface PlaidAccount {
  account_id: string;
  balances: {
    available: number | null;
    current: number | null;
    iso_currency_code: string | null;
    limit: number | null;
    unofficial_currency_code: string | null;
  };
  mask: string;
  name: string;
  official_name: string | null;
  type: 'depository' | 'credit' | 'loan' | 'investment' | 'other';
  subtype: string;
}

export interface PlaidTransaction {
  account_id: string;
  amount: number;
  iso_currency_code: string | null;
  unofficial_currency_code: string | null;
  category: string[];
  category_id: string;
  date: string;
  datetime: string | null;
  authorized_date: string | null;
  authorized_datetime: string | null;
  location: {
    address: string | null;
    city: string | null;
    region: string | null;
    postal_code: string | null;
    country: string | null;
    lat: number | null;
    lon: number | null;
    store_number: string | null;
  };
  name: string;
  merchant_name: string | null;
  payment_meta: {
    by_order_of: string | null;
    payee: string | null;
    payer: string | null;
    payment_method: string | null;
    payment_processor: string | null;
    ppd_id: string | null;
    reason: string | null;
    reference_number: string | null;
  };
  payment_channel: 'online' | 'in store' | 'other';
  pending: boolean;
  pending_transaction_id: string | null;
  account_owner: string | null;
  transaction_id: string;
  transaction_code: string | null;
  transaction_type: 'digital' | 'place' | 'special' | 'unresolved';
}

export interface PlaidInstitution {
  institution_id: string;
  name: string;
  products: string[];
  country_codes: string[];
  url: string | null;
  primary_color: string | null;
  logo: string | null;
}

export interface PlaidLinkToken {
  link_token: string;
  expiration: string;
}

export interface PlaidPublicToken {
  public_token: string;
  institution_id: string;
  institution_name: string;
  accounts: PlaidAccount[];
}

export interface PlaidConnection {
  id: string;
  institutionId: string;
  institutionName: string;
  // accessToken removed - should only be stored server-side
  itemId: string;
  lastSync: Date;
  accounts: string[]; // Account IDs that belong to this connection
  status: 'active' | 'error' | 'updating';
  error?: string;
  // For development only - in production, all API calls go through backend
  isDevelopment?: boolean;
}

class PlaidService {
  private connections: PlaidConnection[] = [];
  private storageKey = 'wealthtracker_plaid_connections';
  private plaidEnv = 'sandbox'; // 'sandbox', 'development', or 'production'
  
  constructor() {
    this.loadConnections();
  }

  private loadConnections() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.connections = parsed.map((conn: SavedPlaidConnection) => {
          // Remove accidentally stored access tokens
          const { accessToken, ...safeConn } = conn;
          return {
            ...safeConn,
            lastSync: new Date(conn.lastSync)
          };
        });
      }
    } catch (error) {
      logger.error('Failed to load Plaid connections:', error);
      this.connections = [];
    }
  }

  private saveConnections() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.connections));
    } catch (error) {
      logger.error('Failed to save Plaid connections:', error);
    }
  }

  // Initialize Plaid Link
  async createLinkToken(clerkId: string): Promise<PlaidLinkToken> {
    try {
      // Use the backend service to create a secure link token
      const result = await plaidBackendService.createLinkToken(clerkId);
      return {
        link_token: result.link_token,
        expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };
    } catch (error) {
      logger.error('Failed to create link token:', error);
      // Fallback to development mode if backend is not available
      if (this.plaidEnv !== 'production') {
        return {
          link_token: `link-${this.plaidEnv}-${Date.now()}`,
          expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        };
      }
      throw error;
    }
  }

  // Exchange public token for access token (handled by backend)
  async exchangePublicToken(
    publicToken: string,
    clerkId: string,
    institutionId: string,
    institutionName: string
  ): Promise<{ access_token: string; item_id: string }> {
    try {
      // Use backend service for secure token exchange
      const connection = await plaidBackendService.exchangePublicToken(
        clerkId,
        publicToken,
        institutionId,
        institutionName
      );
      return {
        access_token: 'stored-securely', // Don't expose actual token to client
        item_id: connection.item_id
      };
    } catch (error) {
      logger.error('Failed to exchange public token:', error);
      // Fallback for development
      if (this.plaidEnv !== 'production') {
        return {
          access_token: `access-${this.plaidEnv}-${Date.now()}`,
          item_id: `item-${Date.now()}`
        };
      }
      throw error;
    }
  }

  // Add a new bank connection
  async addConnection(
    publicTokenData: PlaidPublicToken,
    clerkId: string
  ): Promise<PlaidConnection> {
    const { access_token, item_id } = await this.exchangePublicToken(
      publicTokenData.public_token,
      clerkId,
      publicTokenData.institution_id,
      publicTokenData.institution_name
    );
    
    const connection: PlaidConnection = {
      id: `conn-${Date.now()}`,
      institutionId: publicTokenData.institution_id,
      institutionName: publicTokenData.institution_name,
      itemId: item_id,
      lastSync: new Date(),
      accounts: publicTokenData.accounts.map(acc => acc.account_id),
      status: 'active',
      isDevelopment: this.plaidEnv !== 'production'
    };
    
    // Store connection locally for UI
    this.connections.push(connection);
    this.saveConnections();
    
    // Sync accounts immediately after connection
    if (clerkId) {
      try {
        await this.syncAccountsFromBackend(clerkId, connection.id);
      } catch (error) {
        logger.error('Failed to sync accounts after connection:', error);
      }
    }
    
    return connection;
  }

  // Get all connections
  getConnections(): PlaidConnection[] {
    return [...this.connections];
  }

  // Remove a connection
  async removeConnection(connectionId: string, clerkId?: string): Promise<boolean> {
    try {
      // Remove from backend if clerkId provided
      if (clerkId) {
        await plaidBackendService.removeConnection(clerkId, connectionId);
      }
      
      // Remove from local storage
      const index = this.connections.findIndex(c => c.id === connectionId);
      if (index === -1) return false;
      
      this.connections.splice(index, 1);
      this.saveConnections();
      return true;
    } catch (error) {
      logger.error('Failed to remove connection:', error);
      return false;
    }
  }

  // Sync accounts from backend
  async syncAccountsFromBackend(clerkId: string, connectionId: string): Promise<Account[]> {
    try {
      const plaidAccounts = await plaidBackendService.syncAccounts(clerkId, connectionId);
      
      // Convert to our Account format
      return plaidAccounts.map(acc => {
        const baseAccount = {
          id: acc.account_id,
          name: acc.official_name || acc.name,
          type: this.mapPlaidAccountType(acc.type, acc.subtype),
          balance: acc.balance_current || 0,
          currency: acc.currency || 'USD',
          isActive: true,
          lastUpdated: new Date(),
          plaidConnectionId: connectionId,
          plaidAccountId: acc.account_id
        };

        return acc.mask
          ? { ...baseAccount, mask: acc.mask }
          : baseAccount;
      });
    } catch (error) {
      logger.error('Failed to sync accounts from backend:', error);
      // Fall back to local simulation if backend fails
      return this.syncAccounts(connectionId);
    }
  }

  // Sync accounts from Plaid (local simulation)
  async syncAccounts(connectionId: string): Promise<Account[]> {
    const connection = this.connections.find(c => c.id === connectionId);
    if (!connection) throw new Error('Connection not found');
    
    // In production, this would call your backend API
    // Backend would use the access token to fetch accounts from Plaid
    
    // Simulated Plaid accounts data
    const plaidAccounts: PlaidAccount[] = [
      {
        account_id: `${connection.institutionId}-checking-${Date.now()}`,
        balances: {
          available: 2500.00,
          current: 2600.00,
          iso_currency_code: 'USD',
          limit: null,
          unofficial_currency_code: null
        },
        mask: '1234',
        name: 'Checking Account',
        official_name: 'Personal Checking',
        type: 'depository',
        subtype: 'checking'
      },
      {
        account_id: `${connection.institutionId}-savings-${Date.now()}`,
        balances: {
          available: 10000.00,
          current: 10000.00,
          iso_currency_code: 'USD',
          limit: null,
          unofficial_currency_code: null
        },
        mask: '5678',
        name: 'Savings Account',
        official_name: 'High Yield Savings',
        type: 'depository',
        subtype: 'savings'
      }
    ];
    
    // Convert Plaid accounts to our Account format
    const accounts: Account[] = plaidAccounts.map(plaidAccount => ({
      id: plaidAccount.account_id,
      name: plaidAccount.official_name || plaidAccount.name,
      type: this.mapPlaidAccountType(plaidAccount.type, plaidAccount.subtype),
      balance: plaidAccount.balances.current || 0,
      currency: plaidAccount.balances.iso_currency_code || 'USD',
      isActive: true,
      lastUpdated: new Date(),
      plaidConnectionId: connectionId,
      plaidAccountId: plaidAccount.account_id,
      mask: plaidAccount.mask
    }));
    
    // Update connection's last sync
    connection.lastSync = new Date();
    connection.status = 'active';
    this.saveConnections();
    
    return accounts;
  }

  // Map Plaid account types to our account types
  private mapPlaidAccountType(type: string, subtype: string): Account['type'] {
    if (type === 'depository') {
      return subtype === 'checking' ? 'checking' : 'savings';
    } else if (type === 'credit') {
      return 'credit';
    } else if (type === 'loan') {
      return 'loan';
    } else if (type === 'investment') {
      return 'investment';
    }
    return 'other';
  }

  // Sync transactions from backend
  async syncTransactionsFromBackend(
    clerkId: string,
    connectionId: string,
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<Transaction[]> {
    try {
      const transactions = await plaidBackendService.syncTransactions(
        clerkId,
        connectionId,
        startDate,
        endDate
      );
      
      return transactions.map(txn => {
        const baseTransaction = {
          id: txn.id,
          accountId: txn.account_id,
          date: new Date(txn.date),
          description: txn.description,
          amount: txn.amount,
          type: txn.amount > 0 ? 'income' as const : 'expense' as const,
          category: txn.category,
          pending: txn.pending,
          plaidTransactionId: txn.plaid_transaction_id,
          merchant: txn.merchant_name,
          paymentChannel: txn.payment_channel
        };

        return txn.location_city
          ? {
              ...baseTransaction,
              location: {
                city: txn.location_city,
                region: null,
                country: txn.location_country
              }
            }
          : baseTransaction;
      });
    } catch (error) {
      logger.error('Failed to sync transactions from backend:', error);
      // Fall back to local simulation
      return this.syncTransactions(connectionId, startDate, endDate);
    }
  }

  // Sync transactions from Plaid (local simulation)
  async syncTransactions(connectionId: string, startDate: Date, endDate: Date = new Date()): Promise<Transaction[]> {
    const connection = this.connections.find(c => c.id === connectionId);
    if (!connection) throw new Error('Connection not found');
    
    // In production, this would call your backend API
    // Backend would use the access token to fetch transactions from Plaid
    
    // Simulated Plaid transactions
    const plaidTransactions: PlaidTransaction[] = [
      {
        account_id: connection.accounts[0] || 'default-account',
        amount: 42.50,
        iso_currency_code: 'USD',
        unofficial_currency_code: null,
        category: ['Food and Drink', 'Restaurants'],
        category_id: '13005000',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '',
        datetime: null,
        authorized_date: null,
        authorized_datetime: null,
        location: {
          address: '123 Main St',
          city: 'New York',
          region: 'NY',
          postal_code: '10001',
          country: 'US',
          lat: 40.7128,
          lon: -74.0060,
          store_number: null
        },
        name: 'STARBUCKS',
        merchant_name: 'Starbucks',
        payment_meta: {
          by_order_of: null,
          payee: null,
          payer: null,
          payment_method: null,
          payment_processor: null,
          ppd_id: null,
          reason: null,
          reference_number: null
        },
        payment_channel: 'in store',
        pending: false,
        pending_transaction_id: null,
        account_owner: null,
        transaction_id: `txn-${Date.now()}-1`,
        transaction_code: null,
        transaction_type: 'place'
      },
      {
        account_id: connection.accounts[0] || 'default-account',
        amount: 1200.00,
        iso_currency_code: 'USD',
        unofficial_currency_code: null,
        category: ['Transfer', 'Deposit'],
        category_id: '21007000',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '',
        datetime: null,
        authorized_date: null,
        authorized_datetime: null,
        location: {
          address: null,
          city: null,
          region: null,
          postal_code: null,
          country: null,
          lat: null,
          lon: null,
          store_number: null
        },
        name: 'EMPLOYER DIRECT DEPOSIT',
        merchant_name: null,
        payment_meta: {
          by_order_of: null,
          payee: null,
          payer: 'EMPLOYER INC',
          payment_method: 'ACH',
          payment_processor: null,
          ppd_id: null,
          reason: 'PAYROLL',
          reference_number: null
        },
        payment_channel: 'online',
        pending: false,
        pending_transaction_id: null,
        account_owner: null,
        transaction_id: `txn-${Date.now()}-2`,
        transaction_code: null,
        transaction_type: 'digital'
      }
    ];
    
    // Convert Plaid transactions to our Transaction format
    const transactions: Transaction[] = plaidTransactions.map(plaidTxn => {
      const amount = -plaidTxn.amount; // Plaid uses positive for debits, we use negative
      const baseTransaction = {
        id: plaidTxn.transaction_id,
        accountId: plaidTxn.account_id,
        date: new Date(plaidTxn.date),
        description: plaidTxn.merchant_name || plaidTxn.name,
        amount,
        type: amount >= 0 ? 'income' as const : 'expense' as const,
        category: this.mapPlaidCategory(plaidTxn.category),
        pending: plaidTxn.pending,
        plaidTransactionId: plaidTxn.transaction_id,
        paymentChannel: plaidTxn.payment_channel
      };

      const withMerchant = plaidTxn.merchant_name
        ? { ...baseTransaction, merchant: plaidTxn.merchant_name }
        : baseTransaction;

      return plaidTxn.location.city
        ? {
            ...withMerchant,
            location: {
              city: plaidTxn.location.city,
              region: plaidTxn.location.region,
              country: plaidTxn.location.country
            }
          }
        : withMerchant;
    });
    
    return transactions;
  }

  // Map Plaid categories to our categories
  private mapPlaidCategory(plaidCategories: string[]): string {
    // Map common Plaid categories to our category system
    const categoryMap: Record<string, string> = {
      'Food and Drink': 'Dining',
      'Restaurants': 'Dining',
      'Groceries': 'Groceries',
      'Transportation': 'Transportation',
      'Travel': 'Travel',
      'Shopping': 'Shopping',
      'Bills & Utilities': 'Utilities',
      'Healthcare': 'Healthcare',
      'Entertainment': 'Entertainment',
      'Transfer': 'Transfer',
      'Deposit': 'Income',
      'Withdrawal': 'Other'
    };
    
    for (const category of plaidCategories) {
      if (categoryMap[category]) {
        return categoryMap[category];
      }
    }
    
    return 'Other';
  }

  // Get institution information
  async getInstitution(institutionId: string): Promise<PlaidInstitution> {
    // In production, this would call your backend API
    // Backend would fetch institution details from Plaid
    
    // Simulated response
    return {
      institution_id: institutionId,
      name: 'Example Bank',
      products: ['accounts', 'transactions', 'identity', 'investments'],
      country_codes: ['US'],
      url: 'https://example-bank.com',
      primary_color: '#0066CC',
      logo: null
    };
  }

  // Update connection status
  updateConnectionStatus(connectionId: string, status: PlaidConnection['status'], error?: string) {
    const connection = this.connections.find(c => c.id === connectionId);
    if (connection) {
      connection.status = status;
      if (error) {
        connection.error = error;
      } else if (connection.hasOwnProperty('error')) {
        delete connection.error;
      }
      this.saveConnections();
    }
  }

  // Check if we have active connections
  hasActiveConnections(): boolean {
    return this.connections.some(c => c.status === 'active');
  }

  // Get accounts for a specific connection
  getConnectionAccounts(connectionId: string): string[] {
    const connection = this.connections.find(c => c.id === connectionId);
    return connection ? connection.accounts : [];
  }

  // Load connections from backend
  async loadConnectionsFromBackend(clerkId: string): Promise<void> {
    try {
      const backendConnections = await plaidBackendService.getConnections(clerkId);
      
      // Merge with local connections
      this.connections = backendConnections.map(conn => {
        const connection: PlaidConnection = {
          id: conn.id,
          institutionId: conn.institution_id,
          institutionName: conn.institution_name,
          itemId: conn.item_id,
          lastSync: new Date(conn.last_sync),
          accounts: [], // Will be populated when accounts are synced
          status: (conn.status as 'active' | 'error' | 'updating') || 'active',
          isDevelopment: false
        };

        if (conn.error) {
          connection.error = conn.error;
        }

        return connection;
      });
      
      this.saveConnections();
    } catch (error) {
      logger.error('Failed to load connections from backend:', error);
      // Fall back to local connections
      this.loadConnections();
    }
  }

  // Make authenticated API call through backend
  private async makeAuthenticatedCall<T>(endpoint: string, params: PlaidApiParams): Promise<T> {
    // In production, all Plaid API calls should go through your backend
    // which has the access tokens stored securely
    if (this.plaidEnv === 'production') {
      throw new Error('Production API calls must go through backend');
    }
    
    // Development mode simulation
    logger.warn('Development mode: Simulating API response');
    return {} as T;
  }
}

export const plaidService = new PlaidService();