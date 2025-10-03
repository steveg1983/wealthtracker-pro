import type { Transaction, Account, Category } from '../types';
import type { ChangeRecord } from '../components/FixSummaryModal';

export interface ValidationIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: string;
  description: string;
  affectedItems: string[];
  fix?: () => Promise<ChangeRecord[]>;
  fixDescription?: string;
}

export class ValidationChecksService {
  
  checkFutureTransactions(
    transactions: Transaction[],
    updateTransaction: (id: string, updates: Partial<Transaction>) => void
  ): ValidationIssue | null {
    const now = new Date();
    const futureTransactions = transactions.filter(t => {
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      return tDate > now;
    });
    
    if (futureTransactions.length > 0) {
      return {
        id: 'future-transactions',
        type: 'warning',
        category: 'Date Issues',
        description: `${futureTransactions.length} transaction(s) have future dates`,
        affectedItems: futureTransactions.map(t => t.id),
        fix: async () => {
          const fixChanges: ChangeRecord[] = [];
          for (const transaction of futureTransactions) {
            fixChanges.push({
              id: `${Date.now()}-${transaction.id}`,
              type: 'transaction',
              itemId: transaction.id,
              field: 'date',
              oldValue: transaction.date.toISOString(),
              newValue: now.toISOString(),
              description: `Transaction "${transaction.description}" date changed`,
              issueType: 'Future-dated transactions'
            });
            updateTransaction(transaction.id, { date: now });
          }
          return fixChanges;
        },
        fixDescription: 'Set all future transactions to today\'s date'
      };
    }
    return null;
  }

  checkOldTransactions(transactions: Transaction[]): ValidationIssue | null {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const oldTransactions = transactions.filter(t => {
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      return tDate < fiveYearsAgo;
    });
    
    if (oldTransactions.length > 0) {
      return {
        id: 'old-transactions',
        type: 'info',
        category: 'Date Issues',
        description: `${oldTransactions.length} transaction(s) are older than 5 years`,
        affectedItems: oldTransactions.map(t => t.id)
      };
    }
    return null;
  }

  checkMissingCategories(
    transactions: Transaction[],
    updateTransaction: (id: string, updates: Partial<Transaction>) => void
  ): ValidationIssue | null {
    const uncategorizedTransactions = transactions.filter(t => !t.category || t.category === '');
    
    if (uncategorizedTransactions.length > 0) {
      return {
        id: 'missing-categories',
        type: 'warning',
        category: 'Category Issues',
        description: `${uncategorizedTransactions.length} transaction(s) have no category`,
        affectedItems: uncategorizedTransactions.map(t => t.id),
        fix: async () => {
          const fixChanges: ChangeRecord[] = [];
          const defaultCategory = 'Uncategorized';
          for (const transaction of uncategorizedTransactions) {
            fixChanges.push({
              id: `${Date.now()}-${transaction.id}`,
              type: 'transaction',
              itemId: transaction.id,
              field: 'category',
              oldValue: transaction.category || 'empty',
              newValue: defaultCategory,
              description: `Transaction "${transaction.description}" category set`,
              issueType: 'Missing categories'
            });
            updateTransaction(transaction.id, { category: defaultCategory });
          }
          return fixChanges;
        },
        fixDescription: 'Assign \'Uncategorized\' to all transactions without categories'
      };
    }
    return null;
  }

  checkInvalidCategories(
    transactions: Transaction[],
    categories: Category[],
    updateTransaction: (id: string, updates: Partial<Transaction>) => void
  ): ValidationIssue | null {
    const validCategoryNames = categories.map(c => c.name);
    const invalidCategoryTransactions = transactions.filter(t => 
      t.category && t.category !== '' && !validCategoryNames.includes(t.category)
    );
    
    if (invalidCategoryTransactions.length > 0) {
      return {
        id: 'invalid-categories',
        type: 'error',
        category: 'Category Issues',
        description: `${invalidCategoryTransactions.length} transaction(s) have invalid categories`,
        affectedItems: invalidCategoryTransactions.map(t => t.id),
        fix: async () => {
          const fixChanges: ChangeRecord[] = [];
          const defaultCategory = 'Uncategorized';
          for (const transaction of invalidCategoryTransactions) {
            fixChanges.push({
              id: `${Date.now()}-${transaction.id}`,
              type: 'transaction',
              itemId: transaction.id,
              field: 'category',
              oldValue: transaction.category || 'empty',
              newValue: defaultCategory,
              description: `Transaction "${transaction.description}" category corrected`,
              issueType: 'Invalid categories'
            });
            updateTransaction(transaction.id, { category: defaultCategory });
          }
          return fixChanges;
        },
        fixDescription: 'Reset invalid categories to \'Uncategorized\''
      };
    }
    return null;
  }

  checkInvalidAmounts(transactions: Transaction[]): ValidationIssue | null {
    const invalidAmountTransactions = transactions.filter(t => {
      const amount = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as string);
      return isNaN(amount) || amount === 0;
    });
    
    if (invalidAmountTransactions.length > 0) {
      return {
        id: 'invalid-amounts',
        type: 'error',
        category: 'Amount Issues',
        description: `${invalidAmountTransactions.length} transaction(s) have zero or invalid amounts`,
        affectedItems: invalidAmountTransactions.map(t => t.id)
      };
    }
    return null;
  }

  checkOrphanedTransactions(
    transactions: Transaction[],
    accounts: Account[],
    deleteTransaction: (id: string) => void
  ): ValidationIssue | null {
    const accountIds = new Set(accounts.map(a => a.id));
    const orphanedTransactions = transactions.filter(t => !accountIds.has(t.accountId));
    
    if (orphanedTransactions.length > 0) {
      return {
        id: 'orphaned-transactions',
        type: 'error',
        category: 'Account Issues',
        description: `${orphanedTransactions.length} transaction(s) belong to deleted accounts`,
        affectedItems: orphanedTransactions.map(t => t.id),
        fix: async () => {
          const fixChanges: ChangeRecord[] = [];
          for (const transaction of orphanedTransactions) {
            fixChanges.push({
              id: `${Date.now()}-${transaction.id}`,
              type: 'transaction',
              itemId: transaction.id,
              field: 'deleted',
              oldValue: 'exists',
              newValue: 'deleted',
              description: `Transaction "${transaction.description}" removed`,
              issueType: 'Orphaned transactions'
            });
            deleteTransaction(transaction.id);
          }
          return fixChanges;
        },
        fixDescription: 'Delete all orphaned transactions'
      };
    }
    return null;
  }

  checkDuplicateTransactions(transactions: Transaction[]): ValidationIssue | null {
    const duplicateGroups = new Map<string, Transaction[]>();
    transactions.forEach(t => {
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      const key = `${tDate.toDateString()}_${t.description}_${t.amount}`;
      if (!duplicateGroups.has(key)) {
        duplicateGroups.set(key, []);
      }
      duplicateGroups.get(key)!.push(t);
    });
    
    const duplicates = Array.from(duplicateGroups.values()).filter(group => group.length > 1);
    
    if (duplicates.length > 0) {
      const totalDuplicates = duplicates.reduce((sum, group) => sum + group.length - 1, 0);
      return {
        id: 'duplicate-transactions',
        type: 'warning',
        category: 'Duplicate Issues',
        description: `${totalDuplicates} potential duplicate transaction(s) found`,
        affectedItems: duplicates.flat().map(t => t.id)
      };
    }
    return null;
  }

  checkEmptyDescriptions(
    transactions: Transaction[],
    updateTransaction: (id: string, updates: Partial<Transaction>) => void
  ): ValidationIssue | null {
    const emptyDescTransactions = transactions.filter(t => !t.description || t.description.trim() === '');
    
    if (emptyDescTransactions.length > 0) {
      return {
        id: 'empty-descriptions',
        type: 'warning',
        category: 'Description Issues',
        description: `${emptyDescTransactions.length} transaction(s) have empty descriptions`,
        affectedItems: emptyDescTransactions.map(t => t.id),
        fix: async () => {
          const fixChanges: ChangeRecord[] = [];
          for (const transaction of emptyDescTransactions) {
            const description = `Transaction on ${new Date(transaction.date).toLocaleDateString()}`;
            fixChanges.push({
              id: `${Date.now()}-${transaction.id}`,
              type: 'transaction',
              itemId: transaction.id,
              field: 'description',
              oldValue: transaction.description || 'empty',
              newValue: description,
              description: `Transaction description added`,
              issueType: 'Empty descriptions'
            });
            updateTransaction(transaction.id, { description });
          }
          return fixChanges;
        },
        fixDescription: 'Add default descriptions based on date'
      };
    }
    return null;
  }

  checkAccountBalances(
    accounts: Account[],
    transactions: Transaction[]
  ): ValidationIssue | null {
    const accountsWithDiscrepancies: string[] = [];
    
    accounts.forEach(account => {
      const accountTransactions = transactions.filter(t => t.accountId === account.id);
      const calculatedBalance = accountTransactions.reduce((sum, t) => {
        const amount = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as string);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
      
      const reportedBalance = account.balance || 0;
      const difference = Math.abs(reportedBalance - calculatedBalance);
      
      if (difference > 0.01) {
        accountsWithDiscrepancies.push(account.id);
      }
    });
    
    if (accountsWithDiscrepancies.length > 0) {
      return {
        id: 'balance-discrepancies',
        type: 'error',
        category: 'Balance Issues',
        description: `${accountsWithDiscrepancies.length} account(s) have balance discrepancies`,
        affectedItems: accountsWithDiscrepancies
      };
    }
    return null;
  }

  checkLargeTransactions(
    transactions: Transaction[],
    threshold: number = 10000
  ): ValidationIssue | null {
    const largeTransactions = transactions.filter(t => {
      const amount = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount as string);
      return Math.abs(amount) > threshold;
    });
    
    if (largeTransactions.length > 0) {
      return {
        id: 'large-transactions',
        type: 'info',
        category: 'Amount Issues',
        description: `${largeTransactions.length} transaction(s) exceed $${threshold.toLocaleString()}`,
        affectedItems: largeTransactions.map(t => t.id)
      };
    }
    return null;
  }

  runAllChecks(
    transactions: Transaction[],
    accounts: Account[],
    categories: Category[],
    updateTransaction: (id: string, updates: Partial<Transaction>) => void,
    deleteTransaction: (id: string) => void
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    const checks = [
      this.checkFutureTransactions(transactions, updateTransaction),
      this.checkOldTransactions(transactions),
      this.checkMissingCategories(transactions, updateTransaction),
      this.checkInvalidCategories(transactions, categories, updateTransaction),
      this.checkInvalidAmounts(transactions),
      this.checkOrphanedTransactions(transactions, accounts, deleteTransaction),
      this.checkDuplicateTransactions(transactions),
      this.checkEmptyDescriptions(transactions, updateTransaction),
      this.checkAccountBalances(accounts, transactions),
      this.checkLargeTransactions(transactions)
    ];
    
    checks.forEach(issue => {
      if (issue) {
        issues.push(issue);
      }
    });
    
    return issues;
  }
}

export const validationChecksService = new ValidationChecksService();