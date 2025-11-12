import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AppProvider } from '../../contexts/AppContext';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { BudgetProvider } from '../../contexts/BudgetContext';
import { createMockAccount, createMockTransaction, createMockBudget, createMockGoal } from '../factories';
import Dashboard from '../../pages/Dashboard';
import Budget from '../../pages/Budget';
import { toDecimal } from '../../utils/decimal';
import { formatDecimal } from '../../utils/decimal-format';
import { calculateTotalBalance, calculateBudgetUsage, calculateGoalProgress } from '../../utils/calculations-decimal';
import { toDecimalAccount, toDecimalTransaction, toDecimalBudget, toDecimalGoal } from '../../utils/decimal-converters';

// Mock the router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/' }),
  };
});

describe('Decimal Financial Integration Tests', () => {
  const renderWithProviders = (component: React.ReactElement, initialData = {}) => {
    const mockData = {
      accounts: [],
      transactions: [],
      budgets: [],
      goals: [],
      ...initialData,
    };

    // Mock localStorage
    const storage = new Map();
    Object.entries(mockData).forEach(([key, value]) => {
      storage.set(`wealthtracker_${key}`, JSON.stringify(value));
    });

    vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      storage.set(key, value);
    });

    return render(
      <PreferencesProvider>
        <AppProvider>
          <NotificationProvider>
            <BudgetProvider>
              {component}
            </BudgetProvider>
          </NotificationProvider>
        </AppProvider>
      </PreferencesProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup fresh localStorage mock
    const storage = new Map();
    vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      storage.set(key, value);
    });
    vi.mocked(localStorage.removeItem).mockImplementation(key => {
      storage.delete(key);
    });
    vi.mocked(localStorage.clear).mockImplementation(() => {
      storage.clear();
    });
  });

  describe('Decimal Precision in Financial Calculations', () => {
    it('maintains precision in complex multi-account calculations', () => {
      const accounts = [
        createMockAccount({ id: '1', balance: 999.99 }),
        createMockAccount({ id: '2', balance: 0.01 }),
        createMockAccount({ id: '3', balance: 1000.50 }),
        createMockAccount({ id: '4', balance: -500.33 }),
      ];

      const decimalAccounts = accounts.map(toDecimalAccount);
      const totalBalance = calculateTotalBalance(decimalAccounts);
      
      // Expected: 999.99 + 0.01 + 1000.50 - 500.33 = 1500.17
      expect(totalBalance.toString()).toBe('1500.17');
    });

    it('handles fractional transactions correctly', () => {
      const transactions = [
        createMockTransaction({ id: '1', amount: 33.333, type: 'expense', category: 'groceries' }),
        createMockTransaction({ id: '2', amount: 33.333, type: 'expense', category: 'groceries' }),
        createMockTransaction({ id: '3', amount: 33.334, type: 'expense', category: 'groceries' }),
      ];

      const budget = createMockBudget({ category: 'groceries', amount: 100 });
      
      const decimalTransactions = transactions.map(toDecimalTransaction);
      const decimalBudget = toDecimalBudget(budget);
      
      const usage = calculateBudgetUsage(decimalBudget, decimalTransactions);
      
      // Should sum to exactly 100.00
      expect(usage.toString()).toBe('100');
    });

    it('calculates compound interest with decimal precision', () => {
      const principal = toDecimal('10000.00');
      const rate = toDecimal('0.05'); // 5% annual
      const months = 12;
      
      // Calculate monthly compound interest
      const monthlyRate = rate.dividedBy(12);
      let balance = principal;
      
      for (let i = 0; i < months; i++) {
        const interest = balance.times(monthlyRate);
        balance = balance.plus(interest);
      }
      
      // Should be approximately 10511.62
      const finalBalance = balance.toDecimalPlaces(2);
      expect(finalBalance.toString()).toBe('10511.62');
    });

    it('handles goal progress calculations with precision', () => {
      const goal = createMockGoal({
        id: '1',
        name: 'Emergency Fund',
        targetAmount: 10000,
        currentAmount: 3333.33,
        type: 'savings'
      });

      const decimalGoal = toDecimalGoal(goal);
      const progress = calculateGoalProgress(decimalGoal);
      
      // Should be exactly 33.3333%
      expect(progress).toBeCloseTo(33.3333, 4);
    });
  });

  describe('Multi-Currency Financial Scenarios', () => {
    it.skip('handles multi-currency accounts correctly', async () => {
      const accounts = [
        createMockAccount({ id: '1', balance: 1000, currency: 'GBP' }),
        createMockAccount({ id: '2', balance: 1500, currency: 'USD' }),
        createMockAccount({ id: '3', balance: 2000, currency: 'EUR' }),
      ];

      renderWithProviders(<Dashboard />, { accounts });

      // Should display all accounts with their currencies
      await waitFor(() => {
        expect(screen.getByText(/1[,.]000/)).toBeInTheDocument();
        expect(screen.getByText(/1[,.]500/)).toBeInTheDocument();
        expect(screen.getByText(/2[,.]000/)).toBeInTheDocument();
      });
    });

    it('maintains precision across currency conversions', () => {
      // Test that decimal calculations remain precise even with currency conversions
      const exchangeRates = {
        'USD': toDecimal('1.25'), // 1 GBP = 1.25 USD
        'EUR': toDecimal('1.15'), // 1 GBP = 1.15 EUR
      };

      const gbpAmount = toDecimal('100.00');
      const usdAmount = gbpAmount.times(exchangeRates.USD);
      const eurAmount = gbpAmount.times(exchangeRates.EUR);

      expect(usdAmount.toString()).toBe('125');
      expect(eurAmount.toString()).toBe('115');
      
      // Convert back to GBP
      const backToGbpFromUsd = usdAmount.dividedBy(exchangeRates.USD);
      const backToGbpFromEur = eurAmount.dividedBy(exchangeRates.EUR);
      
      expect(backToGbpFromUsd.toString()).toBe('100');
      expect(backToGbpFromEur.toString()).toBe('100');
    });
  });

  describe('Complex Financial Scenarios', () => {
    it.skip('handles budget overspending scenarios', async () => {
      const transactions = [
        createMockTransaction({ id: '1', amount: 300, type: 'expense', category: 'groceries' }),
        createMockTransaction({ id: '2', amount: 250, type: 'expense', category: 'groceries' }),
        createMockTransaction({ id: '3', amount: 100, type: 'expense', category: 'groceries' }),
      ];

      const budgets = [
        createMockBudget({ id: '1', category: 'groceries', amount: 500 }),
      ];

      renderWithProviders(<Budget />, { transactions, budgets });

      await waitFor(() => {
        // Should show budget overspending (650 > 500)
        expect(screen.getByText(/groceries/i)).toBeInTheDocument();
        expect(screen.getByText(/650/)).toBeInTheDocument();
      });
    });

    it('calculates accurate savings rate with decimal precision', () => {
      const transactions = [
        // Monthly income
        createMockTransaction({ id: '1', amount: 5000, type: 'income' }),
        createMockTransaction({ id: '2', amount: 500, type: 'income' }), // Side income
        
        // Monthly expenses
        createMockTransaction({ id: '3', amount: 1200, type: 'expense' }), // Rent
        createMockTransaction({ id: '4', amount: 400, type: 'expense' }),  // Groceries
        createMockTransaction({ id: '5', amount: 200, type: 'expense' }),  // Utilities
        createMockTransaction({ id: '6', amount: 300, type: 'expense' }),  // Transport
        createMockTransaction({ id: '7', amount: 150, type: 'expense' }),  // Entertainment
      ];

      const decimalTransactions = transactions.map(toDecimalTransaction);
      
      const totalIncome = decimalTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
      
      const totalExpenses = decimalTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
      
      const savings = totalIncome.minus(totalExpenses);
      const savingsRate = savings.dividedBy(totalIncome).times(100);
      
      // Income: 5500, Expenses: 2250, Savings: 3250, Rate: 59.09%
      expect(totalIncome.toString()).toBe('5500');
      expect(totalExpenses.toString()).toBe('2250');
      expect(savings.toString()).toBe('3250');
      expect(savingsRate.toDecimalPlaces(2).toString()).toBe('59.09');
    });

    it('handles debt-to-income ratio calculations', () => {
      const monthlyIncome = toDecimal('6000');
      const debtPayments = [
        toDecimal('1200'), // Mortgage
        toDecimal('400'),  // Car loan
        toDecimal('150'),  // Credit card minimum
        toDecimal('300'),  // Student loan
      ];

      const totalDebtPayments = debtPayments.reduce((sum, payment) => sum.plus(payment), toDecimal(0));
      const debtToIncomeRatio = totalDebtPayments.dividedBy(monthlyIncome).times(100);

      // Total debt: 2050, DTI: 34.17%
      expect(totalDebtPayments.toString()).toBe('2050');
      expect(debtToIncomeRatio.toDecimalPlaces(2).toString()).toBe('34.17');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles zero and negative balances correctly', () => {
      const accounts = [
        createMockAccount({ id: '1', balance: 0 }),
        createMockAccount({ id: '2', balance: -100.50 }),
        createMockAccount({ id: '3', balance: 1000 }),
      ];

      const decimalAccounts = accounts.map(toDecimalAccount);
      const totalBalance = calculateTotalBalance(decimalAccounts);
      
      // Expected: 0 + (-100.50) + 1000 = 899.50
      expect(totalBalance.toString()).toBe('899.5');
    });

    it('handles very large numbers without precision loss', () => {
      const largeAccount = createMockAccount({ 
        id: '1', 
        balance: 999999999.99 
      });

      const decimalAccount = toDecimalAccount(largeAccount);
      const balance = decimalAccount.balance;
      
      // Should maintain precision
      expect(balance.toString()).toBe('999999999.99');
      
      // Test operations on large numbers
      const afterInterest = balance.times(toDecimal('1.05')); // 5% increase
      const formatted = formatDecimal(afterInterest, 2, { group: false });
      expect(formatted).toBe('1049999999.99');
    });

    it('handles very small numbers correctly', () => {
      const microTransactions = [
        createMockTransaction({ id: '1', amount: 0.001, type: 'expense' }),
        createMockTransaction({ id: '2', amount: 0.002, type: 'expense' }),
        createMockTransaction({ id: '3', amount: 0.003, type: 'expense' }),
      ];

      const decimalTransactions = microTransactions.map(toDecimalTransaction);
      const total = decimalTransactions.reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
      
      expect(total.toString()).toBe('0.006');
    });

    it('handles division by zero gracefully', () => {
      const goal = createMockGoal({
        targetAmount: 0,
        currentAmount: 100,
      });

      const decimalGoal = toDecimalGoal(goal);
      const progress = calculateGoalProgress(decimalGoal);
      
      // Should handle division by zero
      expect(progress).toBe(0);
    });
  });

  describe('Performance with Large Datasets', () => {
    it('handles large number of transactions efficiently', () => {
      const startTime = performance.now();
      
      // Create 10,000 transactions
      const transactions = Array.from({ length: 10000 }, (_, i) => 
        createMockTransaction({
          id: `${i + 1}`,
          amount: Math.random() * 1000,
          type: Math.random() > 0.7 ? 'income' : 'expense',
          category: ['groceries', 'utilities', 'transport', 'entertainment'][Math.floor(Math.random() * 4)]
        })
      );

      const decimalTransactions = transactions.map(toDecimalTransaction);
      
      // Calculate totals
      const totalIncome = decimalTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
      
      const totalExpenses = decimalTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
      
      const netAmount = totalIncome.minus(totalExpenses);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Should complete within reasonable time (less than 100ms)
      expect(processingTime).toBeLessThan(100);
      
      // Verify calculations are still accurate
      expect(totalIncome.isPositive()).toBe(true);
      expect(totalExpenses.isPositive()).toBe(true);
      expect(netAmount.toString()).toMatch(/^-?\d+(\.\d+)?$/);
    });

    it('efficiently calculates budget usage across many categories', () => {
      const startTime = performance.now();
      
      // Create 100 budgets
      const budgets = Array.from({ length: 100 }, (_, i) => 
        createMockBudget({
          id: `${i + 1}`,
          category: `category-${i + 1}`,
          amount: (i + 1) * 100
        })
      );

      // Create 5,000 transactions across these categories
      const transactions = Array.from({ length: 5000 }, (_, i) => 
        createMockTransaction({
          id: `${i + 1}`,
          amount: Math.random() * 200,
          type: 'expense',
          category: `category-${(i % 100) + 1}`
        })
      );

      const decimalBudgets = budgets.map(toDecimalBudget);
      const decimalTransactions = transactions.map(toDecimalTransaction);
      
      // Calculate usage for each budget
      const usageResults = decimalBudgets.map(budget => ({
        budget,
        usage: calculateBudgetUsage(budget, decimalTransactions)
      }));
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Should complete within reasonable time
      expect(processingTime).toBeLessThan(200);
      
      // Verify all budgets were processed
      expect(usageResults).toHaveLength(100);
      expect(usageResults.every(result => result.usage.isFinite())).toBe(true);
    });
  });

  describe('Real-world Integration Scenarios', () => {
    it.skip('handles a complete personal finance workflow', async () => {
      // Set up a realistic financial scenario
      const accounts = [
        createMockAccount({ id: '1', name: 'Checking', balance: 2500, type: 'current' }),
        createMockAccount({ id: '2', name: 'Savings', balance: 15000, type: 'savings' }),
        createMockAccount({ id: '3', name: 'Credit Card', balance: -1200, type: 'credit' }),
        createMockAccount({ id: '4', name: 'Investment', balance: 25000, type: 'investment' }),
      ];

      const transactions = [
        // Monthly salary
        createMockTransaction({ id: '1', amount: 4500, type: 'income', accountId: '1' }),
        
        // Monthly expenses
        createMockTransaction({ id: '2', amount: 1200, type: 'expense', category: 'housing', accountId: '1' }),
        createMockTransaction({ id: '3', amount: 400, type: 'expense', category: 'groceries', accountId: '1' }),
        createMockTransaction({ id: '4', amount: 300, type: 'expense', category: 'transport', accountId: '1' }),
        createMockTransaction({ id: '5', amount: 150, type: 'expense', category: 'utilities', accountId: '1' }),
        
        // Credit card payment
        createMockTransaction({ id: '6', amount: 500, type: 'expense', category: 'credit-payment', accountId: '3' }),
        
        // Investment contribution
        createMockTransaction({ id: '7', amount: 800, type: 'expense', category: 'investment', accountId: '4' }),
      ];

      const budgets = [
        createMockBudget({ id: '1', category: 'groceries', amount: 500 }),
        createMockBudget({ id: '2', category: 'transport', amount: 400 }),
        createMockBudget({ id: '3', category: 'utilities', amount: 200 }),
      ];

      const goals = [
        createMockGoal({ id: '1', name: 'Emergency Fund', targetAmount: 20000, currentAmount: 15000 }),
        createMockGoal({ id: '2', name: 'Vacation', targetAmount: 5000, currentAmount: 2000 }),
      ];

      renderWithProviders(<Dashboard />, { accounts, transactions, budgets, goals });

      await waitFor(() => {
        // Should display all accounts
        expect(screen.getByText('Checking')).toBeInTheDocument();
        expect(screen.getByText('Savings')).toBeInTheDocument();
        expect(screen.getByText('Credit Card')).toBeInTheDocument();
        expect(screen.getByText('Investment')).toBeInTheDocument();
        
        // Should show net worth calculation
        // 2500 + 15000 - 1200 + 25000 = 41300
        expect(screen.getByText(/41[,.]300/)).toBeInTheDocument();
      });
    });
  });
});
