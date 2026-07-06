import { describe, it, expect, vi } from 'vitest';
import { FinancialSummaryService, type SummaryData } from '../financialSummaryService';
import { toDecimal } from '../../utils/decimal';
import type { Transaction, Account, Budget } from '../../types';

const createStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value);
    }),
    dump: () => map
  };
};

// SummaryData holds DISPLAY values: aggregates are positive magnitudes
// (totalExpenses 500 means £500 spent), per the signed-storage convention.
const baseSummary: SummaryData = {
  period: 'weekly',
  startDate: new Date('2025-01-06T00:00:00Z'),
  endDate: new Date('2025-01-12T23:59:59Z'),
  totalIncome: toDecimal(1000),
  totalExpenses: toDecimal(500),
  netIncome: toDecimal(500),
  topCategories: [],
  savingsRate: 50,
  accountBalances: [],
  budgetPerformance: [],
  goalProgress: [],
  unusualTransactions: [],
  comparison: {
    incomeChange: 0,
    expenseChange: 0,
    savingsChange: 0
  }
};

// --- Signed-convention fixtures ---------------------------------------------
// Transactions store SIGNED amounts: expenses NEGATIVE, income POSITIVE
// (see src/utils/transactionAmount.ts). Fixtures below encode that live model.

interface TransactionSeed {
  id: string;
  amount: number;
  type: Transaction['type'];
  date: Date;
  category?: string;
  description?: string;
  accountId?: string;
  tags?: string[];
}

const makeTransaction = (seed: TransactionSeed): Transaction => ({
  accountId: 'acc-current',
  description: `${seed.type} ${seed.id}`,
  category: 'General',
  ...seed
});

const makeAccount = (overrides: Partial<Account> & Pick<Account, 'id' | 'name'>): Account => ({
  type: 'current',
  balance: 5000,
  currency: 'GBP',
  lastUpdated: new Date('2025-01-15T12:00:00Z'),
  ...overrides
});

const makeBudget = (
  overrides: Partial<Budget> & Pick<Budget, 'id' | 'categoryId' | 'amount'>
): Budget => ({
  name: 'Budget',
  period: 'monthly',
  isActive: true,
  spent: 0,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides
});

// Wednesday 15 Jan 2025 — mid-week/midday so the Mon 13 – Sun 19 window holds
// in any test-runner timezone.
const referenceDate = new Date('2025-01-15T12:00:00Z');

describe('FinancialSummaryService (deterministic)', () => {
  it('persists summaries via injected storage and enforces history cap', () => {
    const storage = createStorage();
    const now = new Date('2025-01-13T10:00:00Z');
    const service = new FinancialSummaryService({
      storage,
      now: () => now
    });

    for (let i = 0; i < 55; i++) {
      service.saveSummary({
        ...baseSummary,
        startDate: new Date(baseSummary.startDate.getTime() + i * 7 * 86400000),
        endDate: new Date(baseSummary.endDate.getTime() + i * 7 * 86400000)
      });
    }

    const summaries = JSON.parse(storage.dump().get('financialSummaries') ?? '[]');
    expect(summaries).toHaveLength(52);
    expect(storage.setItem).toHaveBeenCalledWith('lastSummaryGenerated', now.toISOString());
  });

  it('determines summary cadence using injected clock and storage', () => {
    const storage = createStorage();
    storage.getItem.mockImplementation((key: string) =>
      key === 'lastSummaryGenerated' ? new Date('2025-01-06T09:00:00Z').toISOString() : null
    );
    const service = new FinancialSummaryService({
      storage,
      now: () => new Date('2025-01-13T09:00:00Z')
    });

    expect(service.shouldGenerateSummary('weekly')).toBe(true);
    expect(service.shouldGenerateSummary('monthly')).toBe(false);
  });
});

describe('FinancialSummaryService aggregates (SIGNED convention: expenses stored negative)', () => {
  const service = new FinancialSummaryService({ storage: null });

  // REGRESSION: the signed-sum bug. Summing raw signed expense amounts made
  // totalExpenses NEGATIVE, so netIncome = income − (negative) reported
  // 1000 − (−400) = 1400 — overstating net income by 2×expenses.
  it('income 1000 + expenses -400 ⇒ totalExpenses 400 (positive), netIncome 600 (NOT 1400), savingsRate 60', () => {
    const transactions: Transaction[] = [
      makeTransaction({
        id: 'salary',
        amount: 1000,
        type: 'income',
        date: new Date('2025-01-14T12:00:00Z'),
        category: 'Salary'
      }),
      makeTransaction({
        id: 'groceries',
        amount: -400,
        type: 'expense',
        date: new Date('2025-01-15T12:00:00Z'),
        category: 'Food'
      })
    ];
    const accounts = [makeAccount({ id: 'acc-current', name: 'Current Account' })];

    const summary = service.generateWeeklySummary(transactions, accounts, [], [], referenceDate);

    expect(summary.totalIncome.toNumber()).toBe(1000);
    expect(summary.totalExpenses.toNumber()).toBe(400);
    expect(summary.totalExpenses.greaterThan(0)).toBe(true);
    expect(summary.netIncome.toNumber()).toBe(600);
    expect(summary.netIncome.toNumber()).not.toBe(1400);
    expect(summary.savingsRate).toBe(60);
  });

  // REGRESSION: with signed amounts, sorting raw sums descending put the
  // SMALLEST spend first. Ranking must use positive magnitudes so the largest
  // spend leads.
  it('ranks top categories by LARGEST spend first from signed (negative) expense fixtures', () => {
    const transactions: Transaction[] = [
      makeTransaction({
        id: 'salary',
        amount: 2000,
        type: 'income',
        date: new Date('2025-01-13T12:00:00Z'),
        category: 'Salary'
      }),
      makeTransaction({
        id: 'rent',
        amount: -1200,
        type: 'expense',
        date: new Date('2025-01-14T12:00:00Z'),
        category: 'Housing'
      }),
      makeTransaction({
        id: 'groceries',
        amount: -150,
        type: 'expense',
        date: new Date('2025-01-15T12:00:00Z'),
        category: 'Food'
      }),
      makeTransaction({
        id: 'restaurant',
        amount: -300,
        type: 'expense',
        date: new Date('2025-01-16T12:00:00Z'),
        category: 'Food'
      }),
      makeTransaction({
        id: 'electricity',
        amount: -75,
        type: 'expense',
        date: new Date('2025-01-17T12:00:00Z'),
        category: 'Bills'
      })
    ];
    const accounts = [makeAccount({ id: 'acc-current', name: 'Current Account' })];

    const summary = service.generateWeeklySummary(transactions, accounts, [], [], referenceDate);

    // Largest spend (Housing 1200) first, then Food (150 + 300 = 450), then Bills (75)
    expect(summary.topCategories.map(c => c.category)).toEqual(['Housing', 'Food', 'Bills']);
    expect(summary.topCategories[0].amount.toNumber()).toBe(1200);
    expect(summary.topCategories[1].amount.toNumber()).toBe(450);
    expect(summary.topCategories[2].amount.toNumber()).toBe(75);

    // Displayed amounts are positive magnitudes; percentages are of total spend (1725)
    summary.topCategories.forEach(cat => {
      expect(cat.amount.greaterThan(0)).toBe(true);
    });
    expect(summary.totalExpenses.toNumber()).toBe(1725);
    expect(summary.topCategories[0].percentage).toBeCloseTo((1200 / 1725) * 100, 5);
    expect(summary.topCategories[1].percentage).toBeCloseTo((450 / 1725) * 100, 5);
    expect(summary.topCategories[2].percentage).toBeCloseTo((75 / 1725) * 100, 5);
  });

  it('computes budget spend and account change as positive-magnitude aggregates from signed rows', () => {
    const transactions: Transaction[] = [
      makeTransaction({
        id: 'salary',
        amount: 2000,
        type: 'income',
        date: new Date('2025-01-13T12:00:00Z'),
        category: 'Salary'
      }),
      makeTransaction({
        id: 'groceries',
        amount: -150,
        type: 'expense',
        date: new Date('2025-01-15T12:00:00Z'),
        category: 'Food'
      }),
      makeTransaction({
        id: 'restaurant',
        amount: -300,
        type: 'expense',
        date: new Date('2025-01-16T12:00:00Z'),
        category: 'Food'
      })
    ];
    const accounts = [makeAccount({ id: 'acc-current', name: 'Current Account', balance: 5000 })];
    const budgets = [makeBudget({ id: 'b-food', name: 'Food Budget', categoryId: 'Food', amount: 600 })];

    const summary = service.generateWeeklySummary(transactions, accounts, budgets, [], referenceDate);

    const foodBudget = summary.budgetPerformance.find(b => b.budgetName === 'Food Budget');
    expect(foodBudget).toBeDefined();
    expect(foodBudget?.spent.toNumber()).toBe(450);
    expect(foodBudget?.limit.toNumber()).toBe(600);
    expect(foodBudget?.percentage).toBe(75);

    const currentAccount = summary.accountBalances.find(a => a.accountName === 'Current Account');
    expect(currentAccount).toBeDefined();
    expect(currentAccount?.balance.toNumber()).toBe(5000);
    // change = income − expense magnitudes: 2000 − 450 = 1550
    expect(currentAccount?.change.toNumber()).toBe(1550);
  });
});
