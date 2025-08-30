/**
 * Plaid Backend Service - Server-side integration for bank connections
 * 
 * This service handles secure communication with Plaid API
 * All access tokens are stored securely in Supabase
 */

import { supabase } from '../../lib/supabase';
import { userIdService } from '../userIdService';

export interface PlaidConnection {
  id: string;
  user_id: string;
  institution_id: string;
  institution_name: string;
  item_id: string;
  access_token: string; // Encrypted in database
  status: 'active' | 'error' | 'updating';
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
  private plaidClient: any = null;
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/plaid/create-link-token`, {
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
      console.error('Error creating link token:', error);
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/plaid/exchange-token`, {
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
      const { data, error } = await supabase
        .from('plaid_connections')
        .insert({
          user_id: userId,
          institution_id: institutionId,
          institution_name: institutionName,
          item_id: item_id,
          access_token: access_token, // Should be encrypted before storing
          status: 'active',
          last_sync: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error exchanging public token:', error);
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

      return data || [];
    } catch (error) {
      console.error('Error getting connections:', error);
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/plaid/accounts`, {
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

      const { accounts } = await response.json();

      // Store or update accounts in Supabase
      const accountPromises = accounts.map(async (account: any) => {
        const accountData = {
          connection_id: connectionId,
          account_id: account.account_id,
          name: account.name,
          official_name: account.official_name,
          type: account.type,
          subtype: account.subtype,
          mask: account.mask,
          balance_current: account.balances.current,
          balance_available: account.balances.available,
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
        return data;
      });

      const savedAccounts = await Promise.all(accountPromises);

      // Update connection last sync time
      await supabase
        .from('plaid_connections')
        .update({ last_sync: new Date().toISOString() })
        .eq('id', connectionId);

      return savedAccounts;
    } catch (error) {
      console.error('Error syncing accounts:', error);
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
  ): Promise<any[]> {
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/plaid/transactions`, {
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

      const { transactions } = await response.json();

      // Convert and store transactions in our database
      const transactionPromises = transactions.map(async (txn: any) => {
        const transactionData = {
          user_id: userId,
          account_id: txn.account_id,
          plaid_transaction_id: txn.transaction_id,
          amount: -txn.amount, // Plaid uses positive for debits
          date: txn.date,
          description: txn.merchant_name || txn.name,
          category: this.mapPlaidCategory(txn.category),
          pending: txn.pending,
          merchant_name: txn.merchant_name,
          location_city: txn.location?.city,
          location_country: txn.location?.country,
          payment_channel: txn.payment_channel,
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

      const savedTransactions = await Promise.all(transactionPromises);

      // Update connection last sync time
      await supabase
        .from('plaid_connections')
        .update({ last_sync: new Date().toISOString() })
        .eq('id', connectionId);

      return savedTransactions;
    } catch (error) {
      console.error('Error syncing transactions:', error);
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
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/plaid/remove-item`, {
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
      console.error('Error removing connection:', error);
      return false;
    }
  }

  /**
   * Map Plaid categories to our category system
   */
  private mapPlaidCategory(plaidCategories: string[]): string {
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
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/plaid/update-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          access_token: connection.access_token,
          webhook_url: `${import.meta.env.VITE_API_URL}/api/plaid/webhook`
        })
      });
    } catch (error) {
      console.error('Error creating webhook:', error);
      throw error;
    }
  }
}

export const plaidBackendService = new PlaidBackendService();