import { bench, describe } from 'vitest';
import {
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetWorth,
  calculateSpendingByCategory,
  calculateMonthlyTrends,
  getRecentTransactions,
  getTopCategories,
} from '../../utils/calculations';
import {
  formatCurrency,
  parseCurrency,
  convertCurrency,
} from '../../utils/currency';
import { formatDecimal } from '../../utils/decimal-format';
import type { Transaction, Account } from '../../types';

// Generate test data
function generateTransactions(count: number): Transaction[] {
  const categories = ['groceries', 'housing', 'transport', 'entertainment', 'utilities'];
  const types: ('income' | 'expense')[] = ['income', 'expense'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `trans-${i}`,
    accountId: `acc-${i % 5}`,
    amount: Math.random() * 1000,
    type: types[Math.floor(Math.random() * types.length)],
    category: categories[Math.floor(Math.random() * categories.length)],
    description: `Transaction ${i}`,
    date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    pending: Math.random() > 0.8,
    isReconciled: Math.random() > 0.5,
  }));
}

function generateAccounts(count: number): Account[] {
  const types = ['current', 'savings', 'credit', 'investment'] as const;
  
  return Array.from({ length: count }, (_, i) => ({
    id: `acc-${i}`,
    name: `Account ${i}`,
    type: types[i % types.length] as Account['type'],
    balance: Math.random() * 50000 - 10000,
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
  }));
}

describe('Financial Calculations Performance', () => {
  const smallDataset = generateTransactions(100);
  const mediumDataset = generateTransactions(1000);
  const largeDataset = generateTransactions(10000);
  const hugeDataset = generateTransactions(50000);

  bench('calculateTotalIncome - 100 transactions', () => {
    calculateTotalIncome(smallDataset);
  });

  bench('calculateTotalIncome - 1,000 transactions', () => {
    calculateTotalIncome(mediumDataset);
  });

  bench('calculateTotalIncome - 10,000 transactions', () => {
    calculateTotalIncome(largeDataset);
  });

  bench('calculateTotalIncome - 50,000 transactions', () => {
    calculateTotalIncome(hugeDataset);
  });

  bench('calculateSpendingByCategory - 1,000 transactions', () => {
    calculateSpendingByCategory(mediumDataset);
  });

  bench('calculateSpendingByCategory - 10,000 transactions', () => {
    calculateSpendingByCategory(largeDataset);
  });

  bench('calculateMonthlyTrends - 1,000 transactions', () => {
    calculateMonthlyTrends(mediumDataset, 12);
  });

  bench('calculateMonthlyTrends - 10,000 transactions', () => {
    calculateMonthlyTrends(largeDataset, 12);
  });

  bench('getRecentTransactions - 10,000 transactions', () => {
    getRecentTransactions(largeDataset, 30);
  });

  bench('getTopCategories - 10,000 transactions', () => {
    getTopCategories(largeDataset, 10);
  });
});

describe('Account Calculations Performance', () => {
  const smallAccounts = generateAccounts(10);
  const mediumAccounts = generateAccounts(100);
  const largeAccounts = generateAccounts(1000);

  bench('calculateNetWorth - 10 accounts', () => {
    calculateNetWorth(smallAccounts);
  });

  bench('calculateNetWorth - 100 accounts', () => {
    calculateNetWorth(mediumAccounts);
  });

  bench('calculateNetWorth - 1,000 accounts', () => {
    calculateNetWorth(largeAccounts);
  });
});

describe('Currency Formatting Performance', () => {
  const amounts = Array.from({ length: 1000 }, () => Math.random() * 100000);
  const formattedAmounts = amounts.map(a => formatCurrency(a, 'GBP'));

  bench('formatCurrency - 1,000 operations', () => {
    amounts.forEach(amount => formatCurrency(amount, 'GBP'));
  });

  bench('parseCurrency - 1,000 operations', () => {
    formattedAmounts.forEach(amount => parseCurrency(amount));
  });

  bench('convertCurrency - 1,000 operations', () => {
    amounts.forEach(amount => convertCurrency(amount, 'USD', 'GBP'));
  });
});

describe('Array Operations Performance', () => {
  const transactions = generateTransactions(10000);

  bench('Filter transactions by type', () => {
    transactions.filter(t => t.type === 'expense');
  });

  bench('Sort transactions by date', () => {
    [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime());
  });

  bench('Group transactions by category', () => {
    transactions.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push(t);
      return acc;
    }, {} as Record<string, Transaction[]>);
  });

  bench('Map and reduce for totals', () => {
    transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  });
});

describe('Date Operations Performance', () => {
  const transactions = generateTransactions(5000);
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = new Date();

  bench('Filter transactions by date range', () => {
    transactions.filter(t => t.date >= startDate && t.date <= endDate);
  });

  bench('Group transactions by month', () => {
    transactions.reduce((acc, t) => {
      const monthKey = `${t.date.getFullYear()}-${t.date.getMonth()}`;
      if (!acc[monthKey]) acc[monthKey] = [];
      acc[monthKey].push(t);
      return acc;
    }, {} as Record<string, Transaction[]>);
  });
});

describe('Memory Intensive Operations', () => {
  bench('Create and process large transaction array', () => {
    const transactions = generateTransactions(5000);
    const income = transactions.filter(t => t.type === 'income');
    const expenses = transactions.filter(t => t.type === 'expense');
    const total = income.reduce((sum, t) => sum + t.amount, 0) - 
                  expenses.reduce((sum, t) => sum + t.amount, 0);
    return total;
  });

  bench('Deep clone large dataset', () => {
    const transactions = generateTransactions(1000);
    JSON.parse(JSON.stringify(transactions));
  });
});

describe('Complex Calculations Performance', () => {
  const transactions = generateTransactions(5000);
  const accounts = generateAccounts(50);

  bench('Full financial summary calculation', () => {
    // Simulate dashboard calculations
    const totalIncome = calculateTotalIncome(transactions);
    const totalExpenses = calculateTotalExpenses(transactions);
    const netWorth = calculateNetWorth(accounts);
    const recentTrans = getRecentTransactions(transactions, 30);
    const topCats = getTopCategories(transactions, 5);
    const monthlyTrends = calculateMonthlyTrends(transactions, 6);
    
    return {
      totalIncome,
      totalExpenses,
      netWorth,
      recentTransCount: recentTrans.length,
      topCategoriesCount: topCats.length,
      trendsCount: monthlyTrends.length,
    };
  });

  bench('Budget analysis for all categories', () => {
    const categories = ['groceries', 'housing', 'transport', 'entertainment', 'utilities'];
    const categorySpending = categories.reduce((acc, cat) => {
      acc[cat] = transactions
        .filter(t => t.type === 'expense' && t.category === cat)
        .reduce((sum, t) => sum + t.amount, 0);
      return acc;
    }, {} as Record<string, number>);
    
    return categorySpending;
  });
});

// Component rendering performance would be tested separately using React testing tools
describe('Data Structure Performance', () => {
  bench('Set operations for transaction IDs', () => {
    const transactions = generateTransactions(5000);
    const idSet = new Set(transactions.map(t => t.id));
    
    // Simulate checking for duplicates
    transactions.forEach(t => idSet.has(t.id));
  });

  bench('Map operations for account lookup', () => {
    const accounts = generateAccounts(100);
    const accountMap = new Map(accounts.map(a => [a.id, a]));
    
    // Simulate frequent lookups
    for (let i = 0; i < 1000; i++) {
      accountMap.get(`acc-${i % 100}`);
    }
  });
});

// Benchmark result type definition
interface BenchmarkResult {
  name: string;
  mean: number;
  min: number;
  max: number;
  p95: number;
}

// Export results formatter for CI/CD integration
export function formatBenchmarkResults(results: BenchmarkResult[]): string {
  const formatValue = (value: number) => formatDecimal(value, 2, { group: false });

  return `
Performance Benchmark Results
=============================
${results.map((r: BenchmarkResult) => `
${r.name}:
  Mean: ${formatValue(r.mean)}ms
  Min: ${formatValue(r.min)}ms
  Max: ${formatValue(r.max)}ms
  P95: ${formatValue(r.p95)}ms
`).join('\n')}
`;
}
