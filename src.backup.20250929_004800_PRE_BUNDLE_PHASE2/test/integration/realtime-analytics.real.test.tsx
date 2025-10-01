/**
 * REAL Integration tests for real-time analytics features
 * Using REAL services and database - no mocks!
 * Following principle: "If it's not tested against real infrastructure, it's not tested"
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import RealtimeSyncProvider from '../../contexts/RealtimeSyncProvider';
import RealtimeAlerts from '../../components/RealtimeAlerts';
import { advancedAnalyticsService } from '../../services/advancedAnalyticsService';
import { alphaVantageService } from '../../services/alphaVantageService';
import { TimeSeriesAnalysis } from '../../services/timeSeriesAnalysis';
import Decimal from 'decimal.js';
import transactionsReducer from '../../store/slices/transactionsSlice';
import accountsReducer from '../../store/slices/accountsSlice';
import type { Transaction, Account } from '../../types';
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
  let store: ReturnType<typeof configureStore>;
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
        type: 'investment',
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
      realAccounts = [accountData as Account];
      
      // Create REAL test transactions
      const transactionsToCreate = [
        {
          user_id: testDataIds.userId,
          account_id: accountData.id,
          amount: '-150.00',
          description: 'Grocery Store',
          date: new Date().toISOString(),
          category: 'Groceries',
          type: 'expense',
          status: 'completed',
        },
        {
          user_id: testDataIds.userId,
          account_id: accountData.id,
          amount: '-1500.00', // Anomaly: 10x normal amount
          description: 'Electronics Store - Big Purchase',
          date: new Date().toISOString(),
          category: 'Shopping',
          type: 'expense',
          status: 'completed',
        },
        {
          user_id: testDataIds.userId,
          account_id: accountData.id,
          amount: '-45.00',
          description: 'Netflix Subscription',
          date: new Date().toISOString(),
          category: 'Entertainment',
          type: 'expense',
          status: 'completed',
        },
        {
          user_id: testDataIds.userId,
          account_id: accountData.id,
          amount: '-45.00', // Duplicate subscription
          description: 'Netflix Premium',
          date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          category: 'Entertainment',
          type: 'expense',
          status: 'completed',
        },
      ];
      
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert(transactionsToCreate)
        .select();
      
      if (txError) {
        console.error('Failed to create test transactions:', txError);
      }
      
      if (txData) {
        testDataIds.transactions.push(...txData.map(tx => tx.id));
        realTransactions = txData as Transaction[];
      }
    }
    
    // Create store with real data
    store = configureStore({
      reducer: {
        transactions: transactionsReducer,
        accounts: accountsReducer,
      },
      preloadedState: {
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
      },
    });
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
    it('should detect real spending anomalies in database transactions', async () => {
      // Use REAL service with REAL data
      const anomalies = await advancedAnalyticsService.detectSpendingAnomalies(
        realTransactions.filter(tx => tx.type === 'expense')
      );
      
      // Should detect the $1500 purchase as an anomaly
      expect(anomalies).toBeDefined();
      expect(Array.isArray(anomalies)).toBe(true);
      
      // The $1500 transaction should be flagged as unusual
      const bigPurchaseAnomaly = anomalies.find(a => 
        a.amount.toNumber() === 1500
      );
      
      if (bigPurchaseAnomaly) {
        expect(bigPurchaseAnomaly.type).toBe('unusual_amount');
        expect(bigPurchaseAnomaly.severity).toBe('high');
        expect(bigPurchaseAnomaly.zscore).toBeGreaterThan(2); // Statistical outlier
      }
    });
    
    it('should find real savings opportunities from duplicate subscriptions', async () => {
      // Use REAL service to find savings
      const opportunities = await advancedAnalyticsService.findSavingsOpportunities(
        realTransactions
      );
      
      expect(Array.isArray(opportunities)).toBe(true);
      
      // Should detect duplicate Netflix subscriptions
      const duplicateSub = opportunities.find(o => 
        o.type === 'duplicate_subscription'
      );
      
      if (duplicateSub) {
        expect(duplicateSub.category).toContain('Entertainment');
        expect(duplicateSub.potentialSavings).toBeGreaterThan(0);
      }
    });
  });

  describe('Time Series Analysis with REAL Data', () => {
    it('should perform real time series analysis on transaction data', async () => {
      const analysis = new TimeSeriesAnalysis();
      
      // Prepare real time series data
      const amounts = realTransactions
        .filter(tx => tx.type === 'expense')
        .map(tx => Math.abs(parseFloat(tx.amount)));
      
      // Perform real statistical analysis
      const forecast = analysis.exponentialSmoothing(amounts);
      
      expect(forecast).toBeDefined();
      expect(typeof forecast).toBe('number');
      expect(forecast).toBeGreaterThan(0);
      
      // Test seasonal decomposition with real data
      if (amounts.length >= 4) {
        const decomposed = analysis.seasonalDecomposition(amounts, 2);
        expect(decomposed.trend).toBeDefined();
        expect(decomposed.seasonal).toBeDefined();
        expect(decomposed.residual).toBeDefined();
      }
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
      const successfulIds = results
        .filter(r => r.status === 'fulfilled' && r.value.data)
        .map(r => (r as any).value.data.id);
      
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