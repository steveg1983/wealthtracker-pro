import { toDecimal } from '../utils/decimal';
import type { Transaction, Account } from '../types';
import type { DecimalTransaction, DecimalInstance } from '../types/decimal-types';

export type FilterType = 'all' | 'income' | 'expense';
export type SortField = 'date' | 'account' | 'description' | 'category' | 'amount';
export type SortDirection = 'asc' | 'desc';

export interface FilterOptions {
  filterType: FilterType;
  filterAccountId: string;
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
}

export interface SortOptions {
  field: SortField;
  direction: SortDirection;
}

export interface TransactionTotals {
  income: DecimalInstance;
  expense: DecimalInstance;
  net: DecimalInstance;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  showAllTransactions: boolean;
}

export interface ColumnWidths {
  date: number;
  reconciled: number;
  account: number;
  description: number;
  category: number;
  amount: number;
  actions: number;
}

class TransactionsPageService {
  getDefaultColumnWidths(): ColumnWidths {
    return {
      date: 120,
      reconciled: 40,
      account: 150,
      description: 300,
      category: 180,
      amount: 120,
      actions: 100
    };
  }

  getDefaultColumnOrder(): string[] {
    return ['date', 'reconciled', 'account', 'description', 'category', 'amount', 'actions'];
  }

  calculateTotals(
    transactions: Transaction[], 
    decimalTransactions: DecimalTransaction[]
  ): TransactionTotals {
    const filteredIds = new Set(transactions.map(t => t.id));
    
    return decimalTransactions
      .filter((t: DecimalTransaction) => filteredIds.has(t.id))
      .reduce((acc: TransactionTotals, t: DecimalTransaction) => {
        if (t.type === 'income') {
          acc.income = acc.income.plus(t.amount);
        } else if (t.type === 'expense') {
          acc.expense = acc.expense.plus(t.amount);
        }
        return acc;
      }, { 
        income: toDecimal(0), 
        expense: toDecimal(0),
        get net() { return this.income.minus(this.expense); }
      });
  }

  calculatePagination(
    totalItems: number,
    currentPage: number,
    itemsPerPage: number,
    showAllTransactions: boolean
  ): PaginationInfo {
    const totalPages = showAllTransactions ? 1 : Math.ceil(totalItems / itemsPerPage);
    const startIndex = showAllTransactions ? 0 : (currentPage - 1) * itemsPerPage;
    const endIndex = showAllTransactions ? totalItems : Math.min(startIndex + itemsPerPage, totalItems);

    return {
      currentPage,
      totalPages,
      startIndex,
      endIndex,
      showAllTransactions
    };
  }

  getFilteredAccountName(accounts: Account[], filterAccountId: string): string | null {
    const account = accounts.find(a => a.id === filterAccountId);
    return account ? account.name : null;
  }

  shouldUseVirtualization(
    itemsPerPage: number,
    showAllTransactions: boolean,
    totalItems: number,
    isMobile: boolean
  ): boolean {
    return (itemsPerPage > 20 || showAllTransactions) && totalItems > 20 && !isMobile;
  }

  getEmptyStateMessage(
    totalTransactions: number,
    searchQuery: string
  ): string {
    if (totalTransactions === 0) {
      return "No transactions yet. Click 'Add Transaction' to record your first one!";
    }
    if (searchQuery) {
      return `No transactions found for "${searchQuery}"`;
    }
    return "No transactions match your filters.";
  }

  handleQuickDateSelect(period: 'today' | 'week' | 'month' | 'year'): { from: string; to: string } {
    const today = new Date();
    const to = today.toISOString().split('T')[0];
    let from = to;

    switch (period) {
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        from = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        from = monthAgo.toISOString().split('T')[0];
        break;
      case 'year':
        const yearAgo = new Date(today);
        yearAgo.setFullYear(today.getFullYear() - 1);
        from = yearAgo.toISOString().split('T')[0];
        break;
    }

    return { from, to };
  }
}

export const transactionsPageService = new TransactionsPageService();