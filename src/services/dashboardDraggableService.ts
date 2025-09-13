import { Layout, Layouts } from 'react-grid-layout';
import { toDecimal } from '../utils/decimal';
import type { Account, Transaction, Budget } from '../types';
import type { DecimalInstance } from '../types/decimal-types';

export interface DashboardWidget {
  id: string;
  title: string;
  value?: string | number;
  subtitle?: string;
  icon?: string;
  color?: string;
  action?: () => void;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
}

export interface TransactionStats {
  income: DecimalInstance;
  expenses: DecimalInstance;
  total: DecimalInstance;
}

export interface BudgetStatus {
  total: number;
  overBudget: number;
  percentage: number;
}

export interface DefaultLayouts extends Layouts {
  lg: Layout[];
  md: Layout[];
  sm: Layout[];
}

class DashboardDraggableService {
  calculateTotalBalance(accounts: Account[]): DecimalInstance {
    return accounts.reduce((sum, account) => {
      const balance = toDecimal(account.balance);
      return sum.plus(balance);
    }, toDecimal(0));
  }

  calculateRecentTransactionsStats(transactions: Transaction[]): TransactionStats {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthTransactions = transactions.filter(t => 
      new Date(t.date) >= startOfMonth
    );

    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));

    const expenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum.plus(toDecimal(Math.abs(t.amount))), toDecimal(0));

    return { income, expenses, total: income.minus(expenses) };
  }

  calculateBudgetStatus(budgets: Budget[]): BudgetStatus {
    const activeBudgets = budgets.filter(b => b.isActive);
    const overBudget = activeBudgets.filter(b => {
      const spent = toDecimal(b.spent || 0);
      const amount = toDecimal(b.amount);
      return spent.greaterThan(amount);
    });

    return {
      total: activeBudgets.length,
      overBudget: overBudget.length,
      percentage: activeBudgets.length > 0 
        ? Math.round((overBudget.length / activeBudgets.length) * 100)
        : 0
    };
  }

  getDefaultLayouts(): DefaultLayouts {
    return {
      lg: [
        { i: 'accounts', x: 0, y: 0, w: 3, h: 3 },
        { i: 'transactions', x: 3, y: 0, w: 3, h: 3 },
        { i: 'spending', x: 6, y: 0, w: 3, h: 3 },
        { i: 'budgets', x: 9, y: 0, w: 3, h: 3 },
        { i: 'balance', x: 0, y: 3, w: 6, h: 3 },
        { i: 'forecast', x: 6, y: 3, w: 3, h: 3 },
        { i: 'actual', x: 9, y: 3, w: 3, h: 3 },
        { i: 'savings', x: 6, y: 6, w: 3, h: 3 },
        { i: 'bills', x: 9, y: 6, w: 3, h: 3 },
        { i: 'overspent', x: 0, y: 7, w: 3, h: 3 },
        { i: 'addTransaction', x: 3, y: 7, w: 3, h: 3 }
      ],
      md: [
        { i: 'accounts', x: 0, y: 0, w: 5, h: 3 },
        { i: 'transactions', x: 5, y: 0, w: 5, h: 3 },
        { i: 'spending', x: 0, y: 3, w: 5, h: 3 },
        { i: 'budgets', x: 5, y: 3, w: 5, h: 3 },
        { i: 'balance', x: 0, y: 6, w: 10, h: 3 },
        { i: 'forecast', x: 0, y: 12, w: 5, h: 3 },
        { i: 'actual', x: 5, y: 12, w: 5, h: 3 },
        { i: 'savings', x: 0, y: 15, w: 5, h: 3 },
        { i: 'bills', x: 5, y: 15, w: 5, h: 3 },
        { i: 'overspent', x: 0, y: 18, w: 5, h: 3 },
        { i: 'addTransaction', x: 5, y: 18, w: 5, h: 3 }
      ],
      sm: [
        { i: 'accounts', x: 0, y: 0, w: 6, h: 3 },
        { i: 'transactions', x: 0, y: 3, w: 6, h: 3 },
        { i: 'spending', x: 0, y: 6, w: 6, h: 3 },
        { i: 'budgets', x: 0, y: 9, w: 6, h: 3 },
        { i: 'balance', x: 0, y: 12, w: 6, h: 3 },
        { i: 'forecast', x: 0, y: 16, w: 6, h: 3 },
        { i: 'actual', x: 0, y: 19, w: 6, h: 3 },
        { i: 'savings', x: 0, y: 22, w: 6, h: 3 },
        { i: 'bills', x: 0, y: 25, w: 6, h: 3 },
        { i: 'overspent', x: 0, y: 28, w: 6, h: 3 },
        { i: 'addTransaction', x: 0, y: 31, w: 6, h: 3 }
      ]
    };
  }

  loadLayouts(): Layouts {
    const savedLayouts = localStorage.getItem('dashboardLayouts');
    const defaultLayouts = this.getDefaultLayouts();
    
    if (savedLayouts) {
      const parsed = JSON.parse(savedLayouts);
      // Merge saved layouts with default layouts, prioritizing default heights
      return {
        lg: defaultLayouts.lg.map(defaultItem => {
          const savedItem = parsed.lg?.find((item: Layout) => item.i === defaultItem.i);
          return savedItem ? { ...savedItem, h: defaultItem.h } : defaultItem;
        }),
        md: defaultLayouts.md.map(defaultItem => {
          const savedItem = parsed.md?.find((item: Layout) => item.i === defaultItem.i);
          return savedItem ? { ...savedItem, h: defaultItem.h } : defaultItem;
        }),
        sm: defaultLayouts.sm.map(defaultItem => {
          const savedItem = parsed.sm?.find((item: Layout) => item.i === defaultItem.i);
          return savedItem ? { ...savedItem, h: defaultItem.h } : defaultItem;
        })
      };
    }
    
    return defaultLayouts;
  }

  saveLayouts(layouts: Layouts): void {
    localStorage.setItem('dashboardLayouts', JSON.stringify(layouts));
  }

  getWidgetIcon(widgetId: string): string {
    switch (widgetId) {
      case 'accounts': return 'CreditCardIcon';
      case 'transactions': return 'BanknotesIcon';
      case 'spending': return 'ChartPieIcon';
      case 'budgets': return 'ChartBarIcon';
      case 'balance': return 'CurrencyDollarIcon';
      case 'bills': return 'BellIcon';
      default: return '';
    }
  }
}

export const dashboardDraggableService = new DashboardDraggableService();
