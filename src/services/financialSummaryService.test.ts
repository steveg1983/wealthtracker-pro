/**
 * FinancialSummaryService Tests
 * Tests for the financial summary service that generates weekly/monthly summaries
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { financialSummaryService } from './financialSummaryService';
import type { Transaction, Account, Budget, Goal } from '../types';
import type { SummaryData } from './financialSummaryService';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] || null)
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock decimal utility
const createMockDecimal = (value: number) => ({
  plus: (other: any) => createMockDecimal(value + (typeof other === 'number' ? other : other.toNumber())),
  minus: (other: any) => createMockDecimal(value - (typeof other === 'number' ? other : other.toNumber())),
  times: (other: number) => createMockDecimal(value * other),
  dividedBy: (other: any) => createMockDecimal(value / (typeof other === 'number' ? other : other.toNumber())),
  abs: () => createMockDecimal(Math.abs(value)),
  greaterThan: (other: number) => value > other,
  greaterThanOrEqualTo: (other: number) => value >= other,
  lessThan: (other: number) => value < other,
  toNumber: () => value,
  toFixed: (decimals: number) => value.toFixed(decimals)
});

vi.mock('../utils/decimal', () => ({
  toDecimal: (value: number) => createMockDecimal(value)
}));

// Test data
const mockTransactions: Transaction[] = [
  {
    id: 't1',
    accountId: 'acc1',
    amount: 2500,
    type: 'income',
    date: new Date('2025-01-20'),
    description: 'Salary',
    category: 'Salary'
  },
  {
    id: 't2',
    accountId: 'acc1',
    amount: 500,
    type: 'expense',
    date: new Date('2025-01-21'),
    description: 'Groceries',
    category: 'Food'
  },
  {
    id: 't3',
    accountId: 'acc2',
    amount: 1200,
    type: 'expense',
    date: new Date('2025-01-22'),
    description: 'Rent',
    category: 'Housing'
  },
  {
    id: 't4',
    accountId: 'acc1',
    amount: 150,
    type: 'expense',
    date: new Date('2025-01-23'),
    description: 'Restaurant',
    category: 'Food'
  },
  {
    id: 't5',
    accountId: 'acc2',
    amount: 100,
    type: 'expense',
    date: new Date('2025-01-24'),
    description: 'Utilities',
    category: 'Bills'
  },
  // Previous week transactions
  {
    id: 't6',
    accountId: 'acc1',
    amount: 2500,
    type: 'income',
    date: new Date('2025-01-13'),
    description: 'Salary',
    category: 'Salary'
  },
  {
    id: 't7',
    accountId: 'acc1',
    amount: 800,
    type: 'expense',
    date: new Date('2025-01-14'),
    description: 'Shopping',
    category: 'Shopping'
  },
  // Unusual transaction
  {
    id: 't8',
    accountId: 'acc1',
    amount: 5000,
    type: 'expense',
    date: new Date('2025-01-25'),
    description: 'New Laptop',
    category: 'Electronics',
    tags: ['unusual']
  }
];

const mockAccounts: Account[] = [
  {
    id: 'acc1',
    name: 'Current Account',
    type: 'checking',
    balance: 5000,
    currency: 'GBP',
    institution: 'Test Bank',
    lastUpdated: new Date()
  },
  {
    id: 'acc2',
    name: 'Savings Account',
    type: 'savings',
    balance: 10000,
    currency: 'GBP',
    institution: 'Test Bank',
    lastUpdated: new Date()
  }
];

const mockBudgets: Budget[] = [
  {
    id: 'b1',
    name: 'Food Budget',
    category: 'Food',
    limit: 600,
    period: 'monthly',
    startDate: '2025-01',
    alerts: { enabled: true, threshold: 80 }
  },
  {
    id: 'b2',
    name: 'Housing Budget',
    category: 'Housing',
    limit: 1200,
    period: 'monthly',
    startDate: '2025-01',
    alerts: { enabled: true, threshold: 90 }
  }
];

const mockGoals: Goal[] = [
  {
    id: 'g1',
    name: 'Emergency Fund',
    type: 'savings',
    targetAmount: 10000,
    currentAmount: 5000,
    targetDate: new Date('2025-12-31'),
    isActive: true,
    linkedAccountIds: ['acc2']
  },
  {
    id: 'g2',
    name: 'Vacation Fund',
    type: 'savings',
    targetAmount: 3000,
    currentAmount: 1000,
    targetDate: new Date('2025-06-30'),
    isActive: true
  }
];

describe('FinancialSummaryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-26')); // Sunday
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateWeeklySummary', () => {
    it('generates summary for current week', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      expect(summary.period).toBe('weekly');
      expect(summary.startDate).toEqual(startOfWeek(new Date('2025-01-26'), { weekStartsOn: 1 }));
      expect(summary.endDate).toEqual(endOfWeek(new Date('2025-01-26'), { weekStartsOn: 1 }));
    });

    it('calculates income and expenses correctly', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      expect(summary.totalIncome.toNumber()).toBe(2500); // t1
      expect(summary.totalExpenses.toNumber()).toBe(6950); // t2 + t3 + t4 + t5 + t8
      expect(summary.netIncome.toNumber()).toBe(-4450);
    });

    it('calculates savings rate', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      // Savings rate = (income - expenses) / income * 100
      // (2500 - 6950) / 2500 * 100 = -178
      expect(summary.savingsRate).toBeCloseTo(-178, 1);
    });

    it('identifies top spending categories', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      expect(summary.topCategories).toHaveLength(4);
      expect(summary.topCategories[0]).toMatchObject({
        category: 'Electronics',
        amount: expect.objectContaining({ toNumber: expect.any(Function) }),
        percentage: expect.any(Number)
      });
      expect(summary.topCategories[0].amount.toNumber()).toBe(5000);
    });

    it('calculates category percentages correctly', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      const electronicsCategory = summary.topCategories.find(c => c.category === 'Electronics');
      expect(electronicsCategory?.percentage).toBeCloseTo(71.94, 1); // 5000/6950 * 100
    });

    it('compares with previous period', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      // Previous week: income 2500, expenses 800
      // Current week: income 2500, expenses 6950
      expect(summary.comparison.incomeChange).toBe(0); // No change
      expect(summary.comparison.expenseChange).toBeCloseTo(768.75, 1); // (6950-800)/800 * 100
    });

    it('identifies unusual transactions', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      expect(summary.unusualTransactions).toHaveLength(2);
      expect(summary.unusualTransactions[0]).toMatchObject({
        description: 'New Laptop',
        date: '25 Jan',
        isHighAmount: true
      });
      expect(summary.unusualTransactions[0].amount.toNumber()).toBe(5000);
    });
  });

  describe('generateMonthlySummary', () => {
    it('generates summary for current month', () => {
      const summary = financialSummaryService.generateMonthlySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      expect(summary.period).toBe('monthly');
      expect(summary.startDate).toEqual(startOfMonth(new Date('2025-01-26')));
      expect(summary.endDate).toEqual(endOfMonth(new Date('2025-01-26')));
    });

    it('includes all month transactions', () => {
      const summary = financialSummaryService.generateMonthlySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      // Should include all January transactions
      expect(summary.totalIncome.toNumber()).toBe(5000); // t1 + t6
      expect(summary.totalExpenses.toNumber()).toBe(7750); // All expense transactions
    });
  });

  describe('budget performance', () => {
    it('calculates budget usage correctly', () => {
      const summary = financialSummaryService.generateMonthlySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      const foodBudget = summary.budgetPerformance.find(b => b.budgetName === 'Food Budget');
      expect(foodBudget).toBeDefined();
      expect(foodBudget?.spent.toNumber()).toBe(650); // t2 + t4
      expect(foodBudget?.limit.toNumber()).toBe(600);
      expect(foodBudget?.percentage).toBeCloseTo(108.33, 1);
    });

    it('identifies over-budget categories', () => {
      const summary = financialSummaryService.generateMonthlySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      const overBudget = summary.budgetPerformance.filter(b => b.percentage > 100);
      expect(overBudget).toHaveLength(1);
      expect(overBudget[0].budgetName).toBe('Food Budget');
    });
  });

  describe('goal progress', () => {
    it('tracks goal progress', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      const emergencyFund = summary.goalProgress.find(g => g.goalName === 'Emergency Fund');
      expect(emergencyFund).toBeDefined();
      expect(emergencyFund?.progress).toBe(50); // 5000/10000 * 100
    });

    it('calculates amount added based on linked accounts', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      // Savings account (acc2) has net change of -1300 (expenses only)
      const emergencyFund = summary.goalProgress.find(g => g.goalName === 'Emergency Fund');
      expect(emergencyFund?.amountAdded.toNumber()).toBe(0); // No positive change
    });

    it('only includes active goals', () => {
      const inactiveGoals = [...mockGoals];
      inactiveGoals[1].isActive = false;

      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        inactiveGoals
      );

      expect(summary.goalProgress).toHaveLength(1);
      expect(summary.goalProgress[0].goalName).toBe('Emergency Fund');
    });
  });

  describe('account balances', () => {
    it('calculates account balance changes', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      const currentAccount = summary.accountBalances.find(a => a.accountName === 'Current Account');
      expect(currentAccount).toBeDefined();
      expect(currentAccount?.balance.toNumber()).toBe(5000);
      // Change: +2500 income, -5650 expenses = -3150
      expect(currentAccount?.change.toNumber()).toBe(-3150);
    });
  });

  describe('saveSummary', () => {
    it('saves summary to localStorage', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      financialSummaryService.saveSummary(summary);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'financialSummaries',
        expect.any(String)
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'lastSummaryGenerated',
        expect.any(String)
      );
    });

    it('maintains history limit for weekly summaries', () => {
      // Create 53 weekly summaries
      for (let i = 0; i < 53; i++) {
        const summary = financialSummaryService.generateWeeklySummary(
          mockTransactions,
          mockAccounts,
          mockBudgets,
          mockGoals
        );
        financialSummaryService.saveSummary(summary);
      }

      const history = financialSummaryService.getSummaryHistory();
      expect(history).toHaveLength(52); // Should keep only last 52
    });

    it('maintains history limit for monthly summaries', () => {
      // Create 13 monthly summaries
      for (let i = 0; i < 13; i++) {
        const summary = financialSummaryService.generateMonthlySummary(
          mockTransactions,
          mockAccounts,
          mockBudgets,
          mockGoals
        );
        financialSummaryService.saveSummary(summary);
      }

      const history = financialSummaryService.getSummaryHistory();
      expect(history).toHaveLength(12); // Should keep only last 12
    });

    it('handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      expect(() => financialSummaryService.saveSummary(summary)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save summary:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('getSummaryHistory', () => {
    it('returns empty array when no history', () => {
      const history = financialSummaryService.getSummaryHistory();
      expect(history).toEqual([]);
    });

    it('returns saved summaries', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );
      financialSummaryService.saveSummary(summary);

      const history = financialSummaryService.getSummaryHistory();
      expect(history).toHaveLength(1);
      expect(history[0].period).toBe('weekly');
    });

    it('handles malformed data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValueOnce('invalid-json');
      
      const history = financialSummaryService.getSummaryHistory();
      expect(history).toEqual([]);
    });
  });

  describe('shouldGenerateSummary', () => {
    it('returns true when no previous summary', () => {
      expect(financialSummaryService.shouldGenerateSummary('weekly')).toBe(true);
      expect(financialSummaryService.shouldGenerateSummary('monthly')).toBe(true);
    });

    it('returns true for weekly on Mondays', () => {
      vi.setSystemTime(new Date('2025-01-27')); // Monday
      
      expect(financialSummaryService.shouldGenerateSummary('weekly')).toBe(true);
    });

    it('returns false for weekly on other days', () => {
      mockLocalStorage.setItem('lastSummaryGenerated', new Date('2025-01-26').toISOString());
      vi.setSystemTime(new Date('2025-01-28')); // Tuesday
      
      expect(financialSummaryService.shouldGenerateSummary('weekly')).toBe(false);
    });

    it('returns true for monthly on 1st', () => {
      vi.setSystemTime(new Date('2025-02-01'));
      
      expect(financialSummaryService.shouldGenerateSummary('monthly')).toBe(true);
    });

    it('returns false for monthly on other days', () => {
      mockLocalStorage.setItem('lastSummaryGenerated', new Date('2025-01-01').toISOString());
      vi.setSystemTime(new Date('2025-01-15'));
      
      expect(financialSummaryService.shouldGenerateSummary('monthly')).toBe(false);
    });

    it('handles invalid dates gracefully', () => {
      mockLocalStorage.getItem.mockReturnValueOnce('invalid-date');
      
      expect(financialSummaryService.shouldGenerateSummary('weekly')).toBe(true);
    });
  });

  describe('formatSummaryText', () => {
    it('formats weekly summary correctly', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      const text = financialSummaryService.formatSummaryText(summary);

      expect(text).toContain("## This Week's Financial Summary");
      expect(text).toContain('Income: £2500.00');
      expect(text).toContain('Expenses: £6950.00');
      expect(text).toContain('Savings Rate: -178.0%');
    });

    it('includes comparison when changes exist', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      const text = financialSummaryService.formatSummaryText(summary);

      expect(text).toContain('Compared to Last Week');
      expect(text).toContain('Income: +0.0%');
      expect(text).toContain('Expenses: +768.8%');
    });

    it('shows over-budget warnings', () => {
      const summary = financialSummaryService.generateMonthlySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      const text = financialSummaryService.formatSummaryText(summary);

      expect(text).toContain('⚠️ Over Budget');
      expect(text).toContain('Food Budget: £650.00 / £600.00');
    });

    it('shows goal progress', () => {
      // Modify test data to show positive progress
      const modifiedAccounts = [...mockAccounts];
      const modifiedTransactions = [
        ...mockTransactions,
        {
          id: 't9',
          accountId: 'acc2',
          amount: 500,
          type: 'income',
          date: new Date('2025-01-24'),
          description: 'Interest',
          category: 'Income'
        }
      ];

      const summary = financialSummaryService.generateWeeklySummary(
        modifiedTransactions,
        modifiedAccounts,
        mockBudgets,
        mockGoals
      );

      const text = financialSummaryService.formatSummaryText(summary);

      expect(text).toContain('Goal Progress');
    });

    it('uses custom currency symbol', () => {
      const summary = financialSummaryService.generateWeeklySummary(
        mockTransactions,
        mockAccounts,
        mockBudgets,
        mockGoals
      );

      const text = financialSummaryService.formatSummaryText(summary, '$');

      expect(text).toContain('Income: $2500.00');
      expect(text).toContain('Expenses: $6950.00');
    });
  });
});