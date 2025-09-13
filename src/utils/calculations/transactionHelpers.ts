/**
 * Transaction Helpers Module
 * Helper functions for transaction filtering and categorization
 */

import type { Transaction } from '../../types';

/**
 * Get transactions by category
 */
export function getTransactionsByCategory(
  transactions: Transaction[], 
  category: string
): Transaction[] {
  return transactions.filter(t => t.category === category);
}

/**
 * Get transactions by date range
 */
export function getTransactionsByDateRange(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): Transaction[] {
  return transactions.filter(t => {
    const date = new Date(t.date);
    return date >= startDate && date <= endDate;
  });
}

/**
 * Get transactions by type
 */
export function getTransactionsByType(
  transactions: Transaction[],
  type: 'income' | 'expense' | 'transfer'
): Transaction[] {
  return transactions.filter(t => t.type === type);
}

/**
 * Get transactions by account
 */
export function getTransactionsByAccount(
  transactions: Transaction[],
  accountId: string
): Transaction[] {
  return transactions.filter(t => t.accountId === accountId);
}

/**
 * Get recent transactions
 */
export function getRecentTransactions(
  transactions: Transaction[],
  days: number = 30
): Transaction[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return transactions.filter(t => new Date(t.date) >= cutoffDate);
}

/**
 * Get top spending categories
 */
export function getTopSpendingCategories(
  transactions: Transaction[],
  limit: number = 5
): Array<{ category: string; amount: number; percentage: number }> {
  const categoryTotals = new Map<string, number>();
  let totalExpenses = 0;
  
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const category = t.category || 'Other';
      const current = categoryTotals.get(category) || 0;
      categoryTotals.set(category, current + t.amount);
      totalExpenses += t.amount;
    });
  
  const categories = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
  
  return categories;
}

/**
 * Get duplicate transactions
 */
export function getDuplicateTransactions(
  transactions: Transaction[],
  threshold: number = 1000 // milliseconds
): Transaction[][] {
  const duplicates: Transaction[][] = [];
  const checked = new Set<string>();
  
  for (let i = 0; i < transactions.length; i++) {
    if (checked.has(transactions[i].id)) continue;
    
    const duplicateGroup: Transaction[] = [transactions[i]];
    checked.add(transactions[i].id);
    
    for (let j = i + 1; j < transactions.length; j++) {
      if (checked.has(transactions[j].id)) continue;
      
      if (
        transactions[i].amount === transactions[j].amount &&
        transactions[i].type === transactions[j].type &&
        transactions[i].category === transactions[j].category &&
        Math.abs(
          new Date(transactions[i].date).getTime() - 
          new Date(transactions[j].date).getTime()
        ) <= threshold
      ) {
        duplicateGroup.push(transactions[j]);
        checked.add(transactions[j].id);
      }
    }
    
    if (duplicateGroup.length > 1) {
      duplicates.push(duplicateGroup);
    }
  }
  
  return duplicates;
}

/**
 * Group transactions by period
 */
export function groupTransactionsByPeriod(
  transactions: Transaction[],
  period: 'day' | 'week' | 'month' | 'year'
): Map<string, Transaction[]> {
  const grouped = new Map<string, Transaction[]>();
  
  transactions.forEach(t => {
    const date = new Date(t.date);
    let key: string;
    
    switch (period) {
      case 'day':
        key = date.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'year':
        key = String(date.getFullYear());
        break;
    }
    
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(t);
  });
  
  return grouped;
}

/**
 * Get category display path (for hierarchical categories)
 */
export function getCategoryDisplayPath(category: string): string {
  // For now, just return the category name
  // This can be expanded to show full hierarchy path if needed
  return category;
}

/**
 * Filter transactions by search term
 */
export function filterTransactionsBySearch(
  transactions: Transaction[],
  searchTerm: string
): Transaction[] {
  const term = searchTerm.toLowerCase();
  
  return transactions.filter(t => 
    t.description?.toLowerCase().includes(term) ||
    t.merchant?.toLowerCase().includes(term) ||
    t.category?.toLowerCase().includes(term) ||
    t.amount.toString().includes(term)
  );
}

/**
 * Sort transactions
 */
export function sortTransactions(
  transactions: Transaction[],
  sortBy: 'date' | 'amount' | 'category' | 'description',
  direction: 'asc' | 'desc' = 'desc'
): Transaction[] {
  const sorted = [...transactions].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
      case 'amount':
        comparison = a.amount - b.amount;
        break;
      case 'category':
        comparison = (a.category || '').localeCompare(b.category || '');
        break;
      case 'description':
        comparison = (a.description || '').localeCompare(b.description || '');
        break;
    }
    
    return direction === 'asc' ? comparison : -comparison;
  });
  
  return sorted;
}
