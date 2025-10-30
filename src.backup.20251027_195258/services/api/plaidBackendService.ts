/**
 * Plaid Backend Service - Server-side integration for bank connections
 * 
 * This service handles secure communication with Plaid API
 * All access tokens are stored securely in Supabase
 */

import { supabase } from '@wealthtracker/core';
import { userIdService } from '../userIdService';
import { logger } from '../loggingService';
import type { Database } from '@app-types/supabase';

type PlaidConnectionRow = Database['public']['Tables']['plaid_connections']['Row'];
type PlaidConnectionInsert = Database['public']['Tables']['plaid_connections']['Insert'];
type PlaidAccountRow = Database['public']['Tables']['plaid_accounts']['Row'];
type PlaidAccountInsert = Database['public']['Tables']['plaid_accounts']['Insert'];
type SupabaseTransactionRow = Database['public']['Tables']['transactions']['Row'];

interface PlaidApiAccount {
  account_id: string;
  name: string;
  official_name?: string | null;
  type: string;
  subtype?: string | null;
  mask?: string | null;
  balances: {
    current: number;
    available?: number | null;
    iso_currency_code?: string | null;
  };
}

interface PlaidApiTransaction {
  account_id: string;
  amount: number;
  transaction_id: string;
  date: string;
  merchant_name?: string | null;
  name: string;
  pending: boolean;
  category?: string[] | null;
  location?: {
    city?: string | null;
    country?: string | null;
  } | null;
  payment_channel?: string | null;
}

type PlaidConnectionStatus = 'active' | 'error' | 'updating';

const toDateOrNow = (value: string | null | undefined): Date => {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
};

const toOptionalTrimmedString = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toFiniteNumber = (value: number | null | undefined): number | undefined => {
  if (typeof value !== 'number') {
    return undefined;
  }
  return Number.isFinite(value) ? value : undefined;
};

const toPlaidStatus = (value: string | null | undefined): PlaidConnectionStatus => {
  if (value === 'error' || value === 'updating' || value === 'active') {
    return value;
  }
  return 'active';
};

const mapConnectionRow = (row: PlaidConnectionRow): PlaidConnection => {
  const institutionId = toOptionalTrimmedString(row.institution_id) ?? row.institution_id;
  const institutionName = toOptionalTrimmedString(row.institution_name) ?? 'Unknown Institution';
  const itemId = toOptionalTrimmedString(row.item_id) ?? row.item_id;

  const connection: PlaidConnection = {
    id: row.id,
    user_id: row.user_id,
    institution_id: institutionId,
    institution_name: institutionName,
    item_id: itemId,
    access_token: row.access_token,
    status: toPlaidStatus(row.status),
    last_sync: toDateOrNow(row.last_sync),
    created_at: toDateOrNow(row.created_at),
    updated_at: toDateOrNow(row.updated_at)
  };

  const errorMessage = toOptionalTrimmedString(row.error_message);
  if (errorMessage) {
    connection.error = errorMessage;
  }

  return connection;
};

const mapAccountRow = (row: PlaidAccountRow): PlaidAccount => {
  const accountName = toOptionalTrimmedString(row.name) ?? 'Account';
  const currency = toOptionalTrimmedString(row.currency) ?? 'USD';

  const account: PlaidAccount = {
    id: row.id,
    connection_id: row.connection_id,
    account_id: row.account_id,
    name: accountName,
    type: row.type,
    subtype: toOptionalTrimmedString(row.subtype) ?? 'unknown',
    balance_current: toFiniteNumber(row.balance_current) ?? 0,
    currency,
    created_at: toDateOrNow(row.created_at),
    updated_at: toDateOrNow(row.updated_at)
  };

  const officialName = toOptionalTrimmedString(row.official_name);
  if (officialName) {
    account.official_name = officialName;
  }

  const mask = toOptionalTrimmedString(row.mask);
  if (mask) {
    account.mask = mask;
  }

  const availableBalance = toFiniteNumber(row.balance_available);
  if (availableBalance !== undefined) {
    account.balance_available = availableBalance;
  }

  return account;
};

export interface PlaidConnection {
  id: string;
  user_id: string;
  institution_id: string;
  institution_name: string;
  item_id: string;
  access_token: string; // Encrypted in database
  status: PlaidConnectionStatus;
  last_sync: Date;
  error?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PlaidAccount {
  id: string;
  connection_id: string;
  account_id: string;
  name: string;
  official_name?: string;
  type: string;
  subtype: string;
  mask?: string;
  balance_current: number;
  balance_available?: number;
  currency: string;
  created_at: Date;
  updated_at: Date;
}

class PlaidBackendService {
  private plaidClient: unknown = null;
  private plaidEnv = import.meta.env.VITE_PLAID_ENV || 'sandbox';
  
  constructor() {
    // Initialize Plaid client if in server environment
    if (typeof window === 'undefined') {
      this.initializePlaidClient();
    }
  }

  private initializePlaidClient() {
    // This would be initialized on the server side
    // const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
    // const configuration = new Configuration({
    //   basePath: PlaidEnvironments[this.plaidEnv],
    //   baseOptions: {
    //     headers: {
    //       'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
    //       'PLAID-SECRET': process.env.PLAID_SECRET,
    //     },
    //   },
    // });
    // this.plaidClient = new PlaidApi(configuration);
  }

  /**
   * Create a Link token for Plaid Link initialization
   */
  async createLinkToken(clerkId: string): Promise<{ link_token: string }> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      // In production, this would call your backend API
      const response = await fetch(`/api/plaid/create-link-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          user_id: userId,
          client_name: 'WealthTracker',
          products: ['accounts', 'transactions'],
          country_codes: ['US', 'GB'],
          language: 'en'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create link token');
      }

      return await response.json();
    } catch (error) {
      logger.error('Error creating link token:', error);
      throw error;
    }
  }

  /**
   * Exchange public token for access token and store securely
   */
  async exchangePublicToken(
    clerkId: string,
    publicToken: string,
    institutionId: string,
    institutionName: string
  ): Promise<PlaidConnection> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      // Exchange public token for access token via backend
      const response = await fetch(`/api/plaid/exchange-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          public_token: publicToken
        })
      });

      if (!response.ok) {
        throw new Error('Failed to exchange public token');
      }

      const { access_token, item_id } = await response.json();

      // Store connection in Supabase (access token should be encrypted)
      const insertPayload: PlaidConnectionInsert = {
        user_id: userId,
        institution_id: institutionId,
        institution_name: institutionName,
        item_id,
        access_token,
        status: 'active',
        last_sync: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('plaid_connections')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      return mapConnectionRow(data);
    } catch (error) {
      logger.error('Error exchanging public token:', error);
      throw error;
    }
  }

  /**
   * Get all connections for a user
   */
  async getConnections(clerkId: string): Promise<PlaidConnection[]> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      const { data, error } = await supabase
        .from('plaid_connections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(mapConnectionRow);
    } catch (error) {
      logger.error('Error getting connections:', error);
      throw error;
    }
  }

  /**
   * Sync accounts from Plaid
   */
  async syncAccounts(clerkId: string, connectionId: string): Promise<PlaidAccount[]> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      // Get connection details
      const { data: connection, error: connError } = await supabase
        .from('plaid_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', userId)
        .single();

      if (connError || !connection) {
        throw new Error('Connection not found');
      }

      // Fetch accounts from Plaid via backend
      const response = await fetch(`/api/plaid/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          access_token: connection.access_token
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const { accounts } = (await response.json()) as { accounts: PlaidApiAccount[] };

      // Store or update accounts in Supabase
      const accountPromises = accounts.map(async (account: PlaidApiAccount) => {
        const accountData: PlaidAccountInsert = {
          connection_id: connectionId,
          account_id: account.account_id,
          name: account.name,
          official_name: account.official_name ?? null,
          type: account.type,
          subtype: account.subtype ?? null,
          mask: account.mask ?? null,
          balance_current: account.balances.current,
          balance_available: account.balances.available ?? null,
          currency: account.balances.iso_currency_code || 'USD',
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('plaid_accounts')
          .upsert(accountData, {
            onConflict: 'account_id'
          })
          .select()
          .single();

        if (error) throw error;
        return mapAccountRow(data);
      });

      const savedAccounts = await Promise.all(accountPromises);

      // Update connection last sync time
      await supabase
        .from('plaid_connections')
        .update({ last_sync: new Date().toISOString() })
        .eq('id', connectionId);

      return savedAccounts;
    } catch (error) {
      logger.error('Error syncing accounts:', error);
      throw error;
    }
  }

  /**
   * Sync transactions from Plaid
   */
  async syncTransactions(
    clerkId: string,
    connectionId: string,
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<SupabaseTransactionRow[]> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      // Get connection details
      const { data: connection, error: connError } = await supabase
        .from('plaid_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', userId)
        .single();

      if (connError || !connection) {
        throw new Error('Connection not found');
      }

      // Fetch transactions from Plaid via backend
      const response = await fetch(`/api/plaid/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          access_token: connection.access_token,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const { transactions } = (await response.json()) as { transactions: PlaidApiTransaction[] };

      // Convert and store transactions in our database
      const transactionPromises = transactions.map(async (txn: PlaidApiTransaction) => {
        const normalizedAmount = -txn.amount;
        const type: 'income' | 'expense' | 'transfer' = txn.amount < 0 ? 'income' : 'expense';

        const transactionData: Database['public']['Tables']['transactions']['Insert'] = {
          user_id: userId,
          account_id: txn.account_id,
          description: txn.merchant_name || txn.name,
          amount: normalizedAmount,
          type,
          date: txn.date,
          notes: txn.pending ? 'Pending transaction' : null,
          metadata: {
            plaidTransactionId: txn.transaction_id,
            plaidCategory: this.mapPlaidCategory(txn.category),
            pending: txn.pending,
            merchantName: txn.merchant_name ?? null,
            locationCity: txn.location?.city ?? null,
            locationCountry: txn.location?.country ?? null,
            paymentChannel: txn.payment_channel ?? null
          },
          created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('transactions')
          .upsert(transactionData, {
            onConflict: 'plaid_transaction_id'
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      });

      const savedTransactions = (await Promise.all(transactionPromises)).filter(
        (txn): txn is SupabaseTransactionRow => Boolean(txn),
      );

      // Update connection last sync time
      await supabase
        .from('plaid_connections')
        .update({ last_sync: new Date().toISOString() })
        .eq('id', connectionId);

      return savedTransactions;
    } catch (error) {
      logger.error('Error syncing transactions:', error);
      throw error;
    }
  }

  /**
   * Remove a connection
   */
  async removeConnection(clerkId: string, connectionId: string): Promise<boolean> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      // Get connection to get access token
      const { data: connection, error: connError } = await supabase
        .from('plaid_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', userId)
        .single();

      if (connError || !connection) {
        throw new Error('Connection not found');
      }

      // Remove item from Plaid via backend
      await fetch(`/api/plaid/remove-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          access_token: connection.access_token
        })
      });

      // Delete connection and related data from database
      const { error } = await supabase
        .from('plaid_connections')
        .delete()
        .eq('id', connectionId)
        .eq('user_id', userId);

      if (error) throw error;

      return true;
    } catch (error) {
      logger.error('Error removing connection:', error);
      return false;
    }
  }

  /**
   * Map Plaid categories to our category system
   */
  private mapPlaidCategory(plaidCategories: string[] | null | undefined): string {
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

    for (const category of plaidCategories || []) {
      if (categoryMap[category]) {
        return categoryMap[category];
      }
    }

    return 'Other';
  }

  /**
   * Get auth token for API requests
   */
  private async getAuthToken(): Promise<string> {
    // In a real implementation, this would get the Clerk session token
    // For now, return a placeholder
    return 'auth-token';
  }

  /**
   * Create webhook for real-time updates
   */
  async createWebhook(clerkId: string, connectionId: string): Promise<void> {
    try {
      const userId = await userIdService.getDatabaseUserId(clerkId);
      if (!userId) throw new Error('User not found');

      // Get connection
      const { data: connection, error: connError } = await supabase
        .from('plaid_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', userId)
        .single();

      if (connError || !connection) {
        throw new Error('Connection not found');
      }

      // Update webhook via backend
      await fetch(`/api/plaid/update-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          access_token: connection.access_token,
          webhook_url: `${window.location.origin}/api/plaid/webhook`
        })
      });
    } catch (error) {
      logger.error('Error creating webhook:', error);
      throw error;
    }
  }
}

export const plaidBackendService = new PlaidBackendService();
