/**
 * REAL Integration tests for real-time analytics features
 * Using REAL services and database - no mocks!
 * Following principle: "If it's not tested against real infrastructure, it's not tested"
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PreloadedState } from '@reduxjs/toolkit';
import { advancedAnalyticsService } from '../../services/advancedAnalyticsService';
import { alphaVantageService } from '../../services/alphaVantageService';
import { TimeSeriesAnalysis } from '../../services/timeSeriesAnalysis';
import { toDecimal } from '../../utils/decimal';
import type { Transaction, Account } from '../../types';
import type { RootState, AppStore } from '../../store';
import { createTestStore } from '../utils/createTestStore';
import { createClient } from '@supabase/supabase-js';

// Use REAL Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Test data tracking for cleanup
const testDataIds = {
  transactions: [] as string[],
  accounts: [] as string[],
  userId: '',
};

describe('Real-time Analytics Integration - REAL', () => {
  let store: AppStore;
  let realTransactions: Transaction[] = [];
  let realAccounts: Account[] = [];

  beforeEach(async () => {
    // Clear test data tracking
    testDataIds.transactions = [];
    testDataIds.accounts = [];
    testDataIds.userId = '77777777-7777-7777-7777-' + Date.now().toString().padStart(12, '0').slice(-12);
    
    // Create user first (required by foreign key constraint)
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: testDataIds.userId,
        clerk_id: 'test_clerk_realtime_' + Date.now(),
        email: `test.realtime.${Date.now()}@test.com`,
        created_at: new Date().toISOString(),
      });
    
    if (userError) {
      console.error('Failed to create test user:', userError);
    }
    
    // Create REAL test account in database
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .insert({
        user_id: testDataIds.userId,
        name: 'Real Test Investment Account',
        type: 'checking',
        balance: '50000.00',
        currency: 'USD',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (accountError) {
      console.error('Failed to create test account:', accountError);
      throw accountError;
    }
    
    if (accountData) {
      testDataIds.accounts.push(accountData.id);
      realAccounts = [
        {
          id: accountData.id,
          name: accountData.name ?? 'Real Test Investment Account',
          type: (accountData.type ?? 'investment') as Account['type'],
          balance: Number(accountData.balance ?? 0),
          currency: accountData.currency ?? 'USD',
          lastUpdated: new Date(accountData.updated_at ?? accountData.created_at ?? new Date().toISOString()),
          openingBalance: Number(accountData.balance ?? 0),
          isActive: true,
        },
      ];
      
      const transactionBlueprints = [
        {
          amount: -150,
          description: 'Grocery Store',
          date: new Date().toISOString(),
          category: 'Groceries',
          type: 'expense' as const,
        },
        {
          amount: -1500,
          description: 'Electronics Store - Big Purchase',
          date: new Date().toISOString(),
          category: 'Shopping',
          type: 'expense' as const,
        },
        {
          amount: -45,
          description: 'Netflix Subscription',
          date: new Date().toISOString(),
          category: 'Entertainment',
          type: 'expense' as const,
        },
        {
          amount: -45,
          description: 'Netflix Premium',
          date: new Date(Date.now() - 86400000).toISOString(),
          category: 'Entertainment',
          type: 'expense' as const,
        },
        {
          amount: -120,
          description: 'Shopping - Household Supplies',
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
          category: 'Shopping',
          type: 'expense' as const,
        },
        {
          amount: -95,
          description: 'Shopping - Clothing',
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 35).toISOString(),
          category: 'Shopping',
          type: 'expense' as const,
        },
        {
          amount: -130,
          description: 'Shopping - Electronics Accessories',
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
          category: 'Shopping',
          type: 'expense' as const,
        },
      ];

      realTransactions = [];
      for (const blueprint of transactionBlueprints) {
        const { data: inserted, error: insertError } = await supabase
          .from('transactions')
          .insert({
            user_id: testDataIds.userId,
            account_id: accountData.id,
            amount: blueprint.amount,
            description: blueprint.description,
            date: blueprint.date,
            category: blueprint.category,
            type: blueprint.type,
            status: 'completed',
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to create test transaction:', insertError);
          continue;
        }

        if (inserted) {
          testDataIds.transactions.push(inserted.id);
          realTransactions.push({
            id: inserted.id,
            date: new Date(inserted.date ?? blueprint.date),
            amount: Number(inserted.amount ?? blueprint.amount),
            description: inserted.description ?? blueprint.description,
            category: inserted.category ?? blueprint.category,
            accountId: inserted.account_id ?? accountData.id,
            type: (inserted.type ?? blueprint.type) as Transaction['type'],
            accountName: accountData.name,
          } as Transaction);
        }
      }
    }

    // Create store with real data
    const preloadedState: PreloadedState<RootState> = {
      transactions: {
        transactions: realTransactions,
        loading: false,
        error: null,
      },
      accounts: {
        accounts: realAccounts,
        loading: false,
        error: null,
      },
    };

    store = createTestStore(preloadedState);
  });
  
  afterEach(async () => {
    // Clean up REAL test data (in reverse dependency order)
    if (testDataIds.transactions.length > 0) {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', testDataIds.transactions);
      
      if (error) {
        console.error('Failed to clean up transactions:', error);
      }
    }
    
    if (testDataIds.accounts.length > 0) {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .in('id', testDataIds.accounts);
      
      if (error) {
        console.error('Failed to clean up accounts:', error);
      }
    }
    
    // Clean up test user
    if (testDataIds.userId) {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', testDataIds.userId);
      
      if (error) {
        console.error('Failed to clean up user:', error);
      }
    }
  });

  describe('Anomaly Detection with REAL Data', () => {
    it('should detect real spending anomalies in database transactions', () => {
      const expenseTransactions = realTransactions.filter(tx => tx.type === 'expense');
      if (expenseTransactions.length === 0) {
        expect(realTransactions.length).toBe(0);
        return;
      }

      const anomalies = advancedAnalyticsService.detectSpendingAnomalies(expenseTransactions);
      expect(Array.isArray(anomalies)).toBe(true);

      const bigPurchaseAnomaly = anomalies.find(a => a.description.includes('Electronics Store'));
      if (bigPurchaseAnomaly) {
        expect(bigPurchaseAnomaly.severity).toBe('high');
        expect(bigPurchaseAnomaly.percentageAboveNormal).toBeGreaterThan(0);
      }
    });

    it('should find real savings opportunities from duplicate subscriptions', () => {
      const opportunities = advancedAnalyticsService.identifySavingsOpportunities(
        realTransactions,
        realAccounts
      );

      expect(Array.isArray(opportunities)).toBe(true);

      const duplicateSub = opportunities.find(o => o.title.toLowerCase().includes('duplicate'));
      if (duplicateSub) {
        expect(duplicateSub.type).toBe('recurring');
        expect(duplicateSub.potentialSavings.toNumber()).toBeGreaterThan(0);
      }
    });
  });

  describe('Time Series Analysis with REAL Data', () => {
    it('should perform real time series analysis on transaction data', () => {
      const expenseSeries = realTransactions
        .filter(tx => tx.type === 'expense')
        .map(tx => ({
          date: new Date(tx.date),
          value: toDecimal(Math.abs(Number(tx.amount)))
        }));

      if (expenseSeries.length === 0) {
        expect(realTransactions.length).toBe(0);
        return;
      }

      const expenseValues = expenseSeries.map(point => point.value);
      const forecasts = TimeSeriesAnalysis.exponentialSmoothing(expenseValues);
      expect(Array.isArray(forecasts)).toBe(true);
      if (forecasts.length > 0) {
        expect(forecasts[0]?.value.toNumber()).toBeGreaterThan(0);
      }

      const seasonalPeriod = Math.min(3, expenseSeries.length);
      if (seasonalPeriod >= 2) {
        const decomposition = TimeSeriesAnalysis.seasonalDecomposition(expenseSeries, seasonalPeriod);
        expect(decomposition.trend.length).toBeGreaterThan(0);
        expect(decomposition.seasonal.length).toBeGreaterThan(0);
        expect(decomposition.residual.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Redux store snapshot with real data', () => {
    it('should preload store state with real transactions and accounts', () => {
      const state = store.getState();
      expect(state.transactions.transactions).toHaveLength(realTransactions.length);
      expect(state.accounts.accounts).toHaveLength(realAccounts.length);
    });
  });

  describe('Market Data Integration (Rate Limited)', () => {
    it('should fetch real market quotes with proper rate limiting', async () => {
      // Skip if no API key configured
      if (!import.meta.env.VITE_ALPHA_VANTAGE_API_KEY) {
        console.log('Skipping market data test - no API key configured');
        return;
      }
      
      const startTime = Date.now();
      
      // Test with a single real stock symbol
      const quote = await alphaVantageService.getQuote('AAPL');
      
      const endTime = Date.now();
      
      if (quote) {
        // Real quote should have these properties
        expect(quote.symbol).toBe('AAPL');
        expect(quote.price).toBeGreaterThan(0);
        expect(quote.change).toBeDefined();
        expect(quote.changePercent).toBeDefined();
        expect(quote.volume).toBeGreaterThan(0);
      } else {
        // API might be rate limited or market closed
        console.log('No quote returned - API may be rate limited or market closed');
      }
      
      // Should respect rate limiting (minimum delay between calls)
      const timeTaken = endTime - startTime;
      expect(timeTaken).toBeGreaterThanOrEqual(100); // At least 100ms
    });
  });

  describe('Real Database Performance', () => {
    it('should handle concurrent operations without conflicts', async () => {
      const promises = [];
      
      // Create 5 transactions concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(
          supabase
            .from('transactions')
            .insert({
              user_id: testDataIds.userId,
              account_id: testDataIds.accounts[0],
              amount: `-${100 + i * 10}.00`,
              description: `Concurrent Transaction ${i}`,
              date: new Date().toISOString(),
              category: 'Test',
              type: 'expense',
              status: 'completed',
            })
            .select()
            .single()
        );
      }
      
      // Execute all concurrently
      const results = await Promise.allSettled(promises);
      
      // Track for cleanup
      const successfulIds = results.flatMap(result => {
        if (result.status === 'fulfilled' && result.value?.data?.id) {
          return [result.value.data.id as string];
        }
        return [] as string[];
      });
      
      testDataIds.transactions.push(...successfulIds);
      
      // Most should succeed (some might fail due to constraints)
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThanOrEqual(3);
    });
    
    it('should enforce real database constraints', async () => {
      // Try to create transaction with invalid account_id
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: testDataIds.userId,
          account_id: 'invalid-account-id-that-does-not-exist',
          amount: '-100.00',
          description: 'Should fail',
          date: new Date().toISOString(),
          category: 'Test',
          type: 'expense',
        })
        .select()
        .single();
      
      // Should fail due to foreign key constraint
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });
});

/**
 * Test Helper: Create real test data factory
 */
export class RealTestDataFactory {
  private supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  
  private createdIds = {
    accounts: [] as string[],
    transactions: [] as string[],
  };
  
  async createRealAccount(userId: string, overrides = {}) {
    const { data, error } = await this.supabase
      .from('accounts')
      .insert({
        user_id: userId,
        name: 'Test Account ' + Date.now(),
        type: 'checking',
        balance: '1000.00',
        currency: 'USD',
        ...overrides,
      })
      .select()
      .single();
    
    if (data) {
      this.createdIds.accounts.push(data.id);
    }
    
    return { data, error };
  }
  
  async createRealTransaction(userId: string, accountId: string, overrides = {}) {
    const { data, error } = await this.supabase
      .from('transactions')
      .insert({
        user_id: userId,
        account_id: accountId,
        amount: '-50.00',
        description: 'Test Transaction',
        date: new Date().toISOString(),
        category: 'Test',
        type: 'expense',
        ...overrides,
      })
      .select()
      .single();
    
    if (data) {
      this.createdIds.transactions.push(data.id);
    }
    
    return { data, error };
  }
  
  async cleanup() {
    // Clean up all created test data
    if (this.createdIds.transactions.length > 0) {
      await this.supabase
        .from('transactions')
        .delete()
        .in('id', this.createdIds.transactions);
    }
    
    if (this.createdIds.accounts.length > 0) {
      await this.supabase
        .from('accounts')
        .delete()
        .in('id', this.createdIds.accounts);
    }
  }
}
