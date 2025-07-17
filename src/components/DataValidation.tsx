import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { Modal } from './common/Modal';
import { 
  AlertCircleIcon,
  CheckCircleIcon,
  WrenchIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  XCircleIcon,
  EyeIcon
} from './icons';
import type { Transaction } from '../types';
import ValidationTransactionModal from './ValidationTransactionModal';
import FixSummaryModal from './FixSummaryModal';
import type { ChangeRecord } from './FixSummaryModal';
import BalanceReconciliationModal from './BalanceReconciliationModal';
import type { ReconciliationOption } from './BalanceReconciliationModal';

interface DataValidationProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ValidationIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: string;
  description: string;
  affectedItems: string[];
  fix?: () => Promise<ChangeRecord[]>;
  fixDescription?: string;
}

export default function DataValidation({ isOpen, onClose }: DataValidationProps) {
  const { transactions, accounts, categories, updateTransaction, deleteTransaction, updateAccount, addTransaction, addCategory } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  const [fixing, setFixing] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  const [fixProgress, setFixProgress] = useState({ current: 0, total: 0 });
  const [detailsModal, setDetailsModal] = useState<{
    isOpen: boolean;
    title: string;
    transactionIds: string[];
    issueType: 'invalid-categories' | 'zero-negative-amounts' | 'large-transactions' | 'other';
  } | null>(null);
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [reconciliationOption, setReconciliationOption] = useState<ReconciliationOption | null>(null);
  const [pendingFixes, setPendingFixes] = useState<{ issue: ValidationIssue, resolve: (changes: ChangeRecord[]) => void } | null>(null);
  
  // Find validation issues
  const validationIssues = useMemo(() => {
    const issues: ValidationIssue[] = [];
    const now = new Date();
    
    // 1. Check for future dated transactions
    const futureTransactions = transactions.filter(t => {
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      return tDate > now;
    });
    
    if (futureTransactions.length > 0) {
      issues.push({
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
              oldValue: transaction.date,
              newValue: now,
              description: `Transaction "${transaction.description}" date changed`,
              issueType: 'Future-dated transactions'
            });
            updateTransaction(transaction.id, { date: now });
          }
          return fixChanges;
        },
        fixDescription: 'Set all future transactions to today\'s date'
      });
    }
    
    // 2. Check for very old transactions (> 5 years)
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const oldTransactions = transactions.filter(t => {
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      return tDate < fiveYearsAgo;
    });
    
    if (oldTransactions.length > 0) {
      issues.push({
        id: 'old-transactions',
        type: 'info',
        category: 'Date Issues',
        description: `${oldTransactions.length} transaction(s) are older than 5 years`,
        affectedItems: oldTransactions.map(t => t.id)
      });
    }
    
    // 3. Check for missing categories
    const uncategorizedTransactions = transactions.filter(t => !t.category || t.category === '');
    
    if (uncategorizedTransactions.length > 0) {
      issues.push({
        id: 'missing-categories',
        type: 'warning',
        category: 'Missing Data',
        description: `${uncategorizedTransactions.length} transaction(s) have no category`,
        affectedItems: uncategorizedTransactions.map(t => t.id),
        fix: async () => {
          const fixChanges: ChangeRecord[] = [];
          for (const transaction of uncategorizedTransactions) {
            fixChanges.push({
              id: `${Date.now()}-${transaction.id}`,
              type: 'transaction',
              itemId: transaction.id,
              field: 'category',
              oldValue: transaction.category || '',
              newValue: 'Other',
              description: `Transaction "${transaction.description}" category set`,
              issueType: 'Missing categories'
            });
            updateTransaction(transaction.id, { category: 'Other' });
          }
          return fixChanges;
        },
        fixDescription: 'Set all uncategorized transactions to "Other"'
      });
    }
    
    // 4. Check for invalid categories (not in category list)
    const validCategoryNames = categories.map(c => c.name);
    const invalidCategoryTransactions = transactions.filter(t => 
      t.category && !validCategoryNames.includes(t.category)
    );
    
    if (invalidCategoryTransactions.length > 0) {
      issues.push({
        id: 'invalid-categories',
        type: 'error',
        category: 'Data Integrity',
        description: `${invalidCategoryTransactions.length} transaction(s) have invalid categories`,
        affectedItems: invalidCategoryTransactions.map(t => t.id),
        fix: async () => {
          const fixChanges: ChangeRecord[] = [];
          for (const transaction of invalidCategoryTransactions) {
            fixChanges.push({
              id: `${Date.now()}-${transaction.id}`,
              type: 'transaction',
              itemId: transaction.id,
              field: 'category',
              oldValue: transaction.category,
              newValue: 'Other',
              description: `Transaction "${transaction.description}" invalid category fixed`,
              issueType: 'Invalid categories'
            });
            updateTransaction(transaction.id, { category: 'Other' });
          }
          return fixChanges;
        },
        fixDescription: 'Reset invalid categories to "Other"'
      });
    }
    
    // 5. Check for zero or negative amounts
    const invalidAmountTransactions = transactions.filter(t => {
      return t.amount <= 0;
    });
    
    if (invalidAmountTransactions.length > 0) {
      issues.push({
        id: 'invalid-amounts',
        type: 'error',
        category: 'Data Integrity',
        description: `${invalidAmountTransactions.length} transaction(s) have zero or negative amounts`,
        affectedItems: invalidAmountTransactions.map(t => t.id)
      });
    }
    
    // 6. Check for orphaned transactions (account doesn't exist)
    const accountIds = new Set(accounts.map(a => a.id));
    const orphanedTransactions = transactions.filter(t => !accountIds.has(t.accountId));
    
    if (orphanedTransactions.length > 0) {
      issues.push({
        id: 'orphaned-transactions',
        type: 'error',
        category: 'Data Integrity',
        description: `${orphanedTransactions.length} transaction(s) belong to non-existent accounts`,
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
              description: `Orphaned transaction "${transaction.description}" deleted`,
              issueType: 'Orphaned transactions'
            });
            deleteTransaction(transaction.id);
          }
          return fixChanges;
        },
        fixDescription: 'Delete all orphaned transactions'
      });
    }
    
    // 7. Check for duplicate transaction descriptions on same day
    const duplicateGroups = new Map<string, Transaction[]>();
    transactions.forEach(t => {
      const tDate = t.date instanceof Date ? t.date : new Date(t.date);
      const key = `${tDate.toDateString()}-${t.description}-${t.amount}`;
      if (!duplicateGroups.has(key)) {
        duplicateGroups.set(key, []);
      }
      duplicateGroups.get(key)!.push(t);
    });
    
    const potentialDuplicates: Transaction[] = [];
    duplicateGroups.forEach(group => {
      if (group.length > 1) {
        potentialDuplicates.push(...group.slice(1));
      }
    });
    
    if (potentialDuplicates.length > 0) {
      issues.push({
        id: 'potential-duplicates',
        type: 'warning',
        category: 'Possible Duplicates',
        description: `${potentialDuplicates.length} potential duplicate transaction(s) found`,
        affectedItems: potentialDuplicates.map(t => t.id)
      });
    }
    
    // 8. Check for empty descriptions
    const emptyDescTransactions = transactions.filter(t => !t.description || t.description.trim() === '');
    
    if (emptyDescTransactions.length > 0) {
      issues.push({
        id: 'empty-descriptions',
        type: 'warning',
        category: 'Missing Data',
        description: `${emptyDescTransactions.length} transaction(s) have empty descriptions`,
        affectedItems: emptyDescTransactions.map(t => t.id),
        fix: async () => {
          const fixChanges: ChangeRecord[] = [];
          for (const transaction of emptyDescTransactions) {
            const newDescription = `${transaction.type} - ${transaction.category}`;
            fixChanges.push({
              id: `${Date.now()}-${transaction.id}`,
              type: 'transaction',
              itemId: transaction.id,
              field: 'description',
              oldValue: transaction.description || '',
              newValue: newDescription,
              description: `Transaction description generated`,
              issueType: 'Empty descriptions'
            });
            updateTransaction(transaction.id, { 
              description: newDescription 
            });
          }
          return fixChanges;
        },
        fixDescription: 'Generate descriptions from type and category'
      });
    }
    
    // 9. Check account balances vs transaction totals
    accounts.forEach(account => {
      const accountTransactions = transactions.filter(t => t.accountId === account.id);
      const openingBalance = account.openingBalance || 0;
      
      // Calculate the sum of transactions properly
      // For transfers, we need to check if this account is the source or destination
      const transactionSum = accountTransactions.reduce((sum, t) => {
        if (t.type === 'income') {
          return sum + t.amount;
        } else if (t.type === 'expense') {
          return sum - t.amount;
        } else if (t.type === 'transfer') {
          // For transfers, check if there's a paired transaction
          // If this is the source account, subtract the amount
          // If this is the destination account, add the amount
          // For now, we'll treat transfers as expenses from the source account
          return sum - t.amount;
        }
        return sum;
      }, 0);
      
      // Debug logging
      const incomeTotal = accountTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expenseTotal = accountTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const transferTotal = accountTransactions.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0);
      
      console.log(`Account: ${account.name}`, {
        transactionCount: accountTransactions.length,
        income: incomeTotal,
        expenses: expenseTotal,
        transfers: transferTotal,
        transactionSum,
        openingBalance,
        calculatedBalance: openingBalance + transactionSum,
        actualBalance: account.balance,
        // Additional debug
        manualCalc: openingBalance + incomeTotal - expenseTotal - transferTotal,
        types: accountTransactions.reduce((acc, t) => {
          acc[t.type] = (acc[t.type] || 0) + 1;
          return acc;
        }, {})
      });
      
      const calculatedBalance = openingBalance + transactionSum;
      
      const actualBalance = account.balance;
      const difference = actualBalance - calculatedBalance; // Don't use Math.abs here!
      
      if (Math.abs(difference) > 0.01) {
        issues.push({
          id: `balance-mismatch-${account.id}`,
          type: 'warning',
          category: 'Balance Issues',
          description: `${account.name} balance differs from transaction sum by ${formatCurrency(Math.abs(difference))}`,
          affectedItems: [account.id],
          fix: async () => {
            // Return a promise that will be resolved when user makes their choice
            return new Promise<ChangeRecord[]>((resolve) => {
              // Show reconciliation modal
              setReconciliationOption({
                type: 'opening-balance',
                accountId: account.id,
                accountName: account.name,
                currentBalance: actualBalance,
                calculatedBalance: calculatedBalance,
                difference: actualBalance - calculatedBalance
              });
              
              // Store the resolve function to use when user makes their choice
              setPendingFixes({
                issue: issues.find(i => i.id === `balance-mismatch-${account.id}`)!,
                resolve
              });
            });
          },
          fixDescription: 'Choose reconciliation method'
        });
      }
    });
    
    // 10. Check for very large transactions (potential data entry errors)
    const avgAmount = transactions.reduce((sum, t) => {
      return sum + t.amount;
    }, 0) / transactions.length;
    
    const largeTransactions = transactions.filter(t => {
      return t.amount > avgAmount * 10; // 10x average
    });
    
    if (largeTransactions.length > 0) {
      issues.push({
        id: 'large-transactions',
        type: 'info',
        category: 'Unusual Data',
        description: `${largeTransactions.length} transaction(s) are unusually large (>10x average)`,
        affectedItems: largeTransactions.map(t => t.id)
      });
    }
    
    return issues;
  }, [transactions, accounts, categories]);

  // Group issues by category
  const issuesByCategory = useMemo(() => {
    const grouped = new Map<string, ValidationIssue[]>();
    validationIssues.forEach(issue => {
      if (!grouped.has(issue.category)) {
        grouped.set(issue.category, []);
      }
      grouped.get(issue.category)!.push(issue);
    });
    return grouped;
  }, [validationIssues]);

  // Count issues by type
  const issueCounts = useMemo(() => {
    const counts = { error: 0, warning: 0, info: 0 };
    validationIssues.forEach(issue => {
      counts[issue.type]++;
    });
    return counts;
  }, [validationIssues]);

  const handleSelectAll = () => {
    const allFixableIds = validationIssues
      .filter(issue => issue.fix)
      .map(issue => issue.id);
    setSelectedIssues(new Set(allFixableIds));
  };

  const handleDeselectAll = () => {
    setSelectedIssues(new Set());
  };

  const handleToggleIssue = (id: string) => {
    const newSelected = new Set(selectedIssues);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIssues(newSelected);
  };

  const handleFixSelected = async () => {
    const issuesToFix = validationIssues.filter(issue => 
      selectedIssues.has(issue.id) && issue.fix
    );
    
    if (issuesToFix.length === 0) return;
    
    setFixing(true);
    setFixProgress({ current: 0, total: issuesToFix.length });
    const allChanges: ChangeRecord[] = [];
    
    try {
      for (let i = 0; i < issuesToFix.length; i++) {
        setFixProgress({ current: i + 1, total: issuesToFix.length });
        const changes = await issuesToFix[i].fix!();
        allChanges.push(...changes);
        // Add a small delay to prevent React update depth exceeded error
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Reset after fixing
      setSelectedIssues(new Set());
      
      // Show summary
      setChanges(allChanges);
      setShowSummary(true);
    } catch (error) {
      console.error('Error fixing issues:', error);
    } finally {
      setFixing(false);
      setFixProgress({ current: 0, total: 0 });
    }
  };

  const handleUndo = (changeId: string) => {
    const change = changes.find(c => c.id === changeId);
    if (!change) return;

    // Apply the reverse change
    if (change.type === 'transaction') {
      if (change.field === 'deleted') {
        // Can't undo deletions in this simple implementation
        console.warn('Cannot undo deletion');
      } else {
        updateTransaction(change.itemId, { [change.field]: change.oldValue });
      }
    } else if (change.type === 'account') {
      updateAccount(change.itemId, { [change.field]: change.oldValue });
    }

    // Remove from changes list
    setChanges(changes.filter(c => c.id !== changeId));
  };

  const handleUndoAll = () => {
    // Apply all changes in reverse order
    [...changes].reverse().forEach(change => {
      if (change.type === 'transaction' && change.field !== 'deleted') {
        updateTransaction(change.itemId, { [change.field]: change.oldValue });
      } else if (change.type === 'account') {
        updateAccount(change.itemId, { [change.field]: change.oldValue });
      }
    });

    // Clear changes and close modal
    setChanges([]);
    setShowSummary(false);
  };

  const handleReconciliationChoice = async (type: 'opening-balance' | 'adjustment-transaction') => {
    if (!reconciliationOption || !pendingFixes) return;

    const { accountId, accountName, currentBalance, calculatedBalance, difference } = reconciliationOption;
    const fixChanges: ChangeRecord[] = [];

    if (type === 'opening-balance') {
      // Update the account's opening balance
      const account = accounts.find(a => a.id === accountId);
      const currentOpeningBalance = account?.openingBalance || 0;
      const newOpeningBalance = currentOpeningBalance + difference;

      console.log('Updating opening balance:', {
        account: accountName,
        currentOpeningBalance,
        difference,
        newOpeningBalance
      });

      updateAccount(accountId, { 
        openingBalance: newOpeningBalance,
        openingBalanceDate: account?.openingBalanceDate || new Date()
      });

      fixChanges.push({
        id: `${Date.now()}-opening-balance`,
        type: 'account',
        itemId: accountId,
        field: 'openingBalance',
        oldValue: currentOpeningBalance,
        newValue: newOpeningBalance,
        description: `${accountName}: Opening balance adjusted by ${formatCurrency(difference)} to reconcile account`,
        issueType: 'Balance reconciliation - Opening Balance'
      });
    } else {
      // Check if Account Adjustments category exists, create if not
      let adjustmentCategory = categories.find(c => c.id === 'account-adjustments');
      
      if (!adjustmentCategory) {
        console.log('Account Adjustments category not found, creating it...');
        
        // First check if the parent category exists
        let adjustmentParent = categories.find(c => c.id === 'sub-adjustments');
        
        if (!adjustmentParent) {
          // Create the parent category first
          addCategory({
            name: 'Adjustments',
            type: 'both',
            level: 'sub',
            parentId: 'type-expense',
            isSystem: true
          });
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Now create the Account Adjustments category
        addCategory({
          name: 'Account Adjustments',
          type: 'both',
          level: 'detail',
          parentId: 'sub-adjustments',
          isSystem: true
        });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Re-fetch to get the new category with its ID
        adjustmentCategory = categories.find(c => c.name === 'Account Adjustments');
      }
      
      const categoryToUse = adjustmentCategory?.id || adjustmentCategory?.name || 'Account Adjustments';
      
      console.log('Categories available:', categories.length, 'categories');
      console.log('Adjustment category:', adjustmentCategory);
      console.log('Using category:', categoryToUse);

      // Create adjustment transaction
      const adjustmentType = difference > 0 ? 'income' : 'expense';
      const adjustmentDescription = `Balance adjustment - ${accountName}`;
      
      const newTransaction = {
        date: new Date(),
        description: adjustmentDescription,
        amount: Math.abs(difference),
        category: categoryToUse,
        accountId: accountId,
        type: adjustmentType as 'income' | 'expense',
        cleared: true
      };

      console.log('Creating adjustment transaction:', {
        account: accountName,
        accountId,
        difference,
        adjustmentType,
        amount: Math.abs(difference),
        category: categoryToUse,
        categoryName: adjustmentCategory?.name || 'Account Adjustments',
        transaction: newTransaction
      });

      // Check current transactions before adding
      const transactionsBefore = transactions.filter(t => t.accountId === accountId);
      console.log(`Before: Account ${accountName} has ${transactionsBefore.length} transactions`);

      try {
        addTransaction(newTransaction);
        console.log('Transaction added successfully');
        
        // Add a delay to ensure state updates
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error('Error adding transaction:', error);
      }

      fixChanges.push({
        id: `${Date.now()}-transaction`,
        type: 'transaction',
        itemId: Date.now().toString(),
        field: 'created',
        oldValue: 'no transaction',
        newValue: `${adjustmentType} ${formatCurrency(Math.abs(difference))}`,
        description: `Created ${adjustmentType} transaction of ${formatCurrency(Math.abs(difference))} in "${accountName}" with category "Account Adjustments"`,
        issueType: 'Balance reconciliation - Adjustment Transaction'
      });
    }

    // Resolve the promise with the changes
    pendingFixes.resolve(fixChanges);
    
    // Clear the modal states
    setReconciliationOption(null);
    setPendingFixes(null);
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircleIcon className="text-red-500" size={20} />;
      case 'warning':
        return <AlertTriangleIcon className="text-yellow-500" size={20} />;
      case 'info':
        return <AlertCircleIcon className="text-blue-500" size={20} />;
      default:
        return null;
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Data Validation & Cleanup"
      >
      <div className="p-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className={`rounded-lg p-4 ${
            issueCounts.error > 0
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Errors</div>
                <div className="text-2xl font-semibold mt-1">{issueCounts.error}</div>
              </div>
              <XCircleIcon className={issueCounts.error > 0 ? 'text-red-500' : 'text-gray-400'} size={32} />
            </div>
          </div>
          
          <div className={`rounded-lg p-4 ${
            issueCounts.warning > 0
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
              : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Warnings</div>
                <div className="text-2xl font-semibold mt-1">{issueCounts.warning}</div>
              </div>
              <AlertTriangleIcon className={issueCounts.warning > 0 ? 'text-yellow-500' : 'text-gray-400'} size={32} />
            </div>
          </div>
          
          <div className={`rounded-lg p-4 ${
            issueCounts.info > 0
              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
              : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Info</div>
                <div className="text-2xl font-semibold mt-1">{issueCounts.info}</div>
              </div>
              <AlertCircleIcon className={issueCounts.info > 0 ? 'text-blue-500' : 'text-gray-400'} size={32} />
            </div>
          </div>
        </div>

        {validationIssues.length === 0 ? (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-8 text-center">
            <CheckCircleIcon className="mx-auto text-green-600 dark:text-green-400 mb-3" size={48} />
            <h4 className="text-lg font-medium text-green-900 dark:text-green-300">
              All data looks good!
            </h4>
            <p className="text-sm text-green-800 dark:text-green-200 mt-1">
              No validation issues found in your financial data.
            </p>
          </div>
        ) : (
          <>
            {/* Actions */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 
                           hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  Select All Fixable
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 
                           hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  Deselect All
                </button>
              </div>
              <button
                onClick={handleFixSelected}
                disabled={selectedIssues.size === 0 || fixing}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                         hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {fixing ? (
                  <>
                    <RefreshCwIcon size={20} className="animate-spin" />
                    Fixing ({fixProgress.current}/{fixProgress.total})...
                  </>
                ) : (
                  <>
                    <WrenchIcon size={20} />
                    Fix Selected Issues
                  </>
                )}
              </button>
            </div>

            {/* Issues List */}
            <div className="space-y-6">
              {Array.from(issuesByCategory).map(([category, categoryIssues]) => (
                <div key={category}>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">{category}</h3>
                  <div className="space-y-3">
                    {categoryIssues.map(issue => (
                      <div
                        key={issue.id}
                        className={`rounded-lg border p-4 ${
                          issue.type === 'error'
                            ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                            : issue.type === 'warning'
                            ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                            : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {issue.fix && (
                            <input
                              type="checkbox"
                              checked={selectedIssues.has(issue.id)}
                              onChange={() => handleToggleIssue(issue.id)}
                              className="mt-1"
                            />
                          )}
                          {getIssueIcon(issue.type)}
                          <div className="flex-1">
                            <div className="font-medium">{issue.description}</div>
                            {issue.fixDescription && (
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Fix: {issue.fixDescription}
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              <div className="text-xs text-gray-500">
                                Affects {issue.affectedItems.length} item(s)
                              </div>
                              <button
                                onClick={() => {
                                  let issueType: 'invalid-categories' | 'zero-negative-amounts' | 'large-transactions' | 'other' = 'other';
                                  if (issue.id === 'invalid-categories') issueType = 'invalid-categories';
                                  else if (issue.id === 'invalid-amounts') issueType = 'zero-negative-amounts';
                                  else if (issue.id === 'large-transactions') issueType = 'large-transactions';
                                  
                                  setDetailsModal({
                                    isOpen: true,
                                    title: issue.description,
                                    transactionIds: issue.affectedItems,
                                    issueType
                                  });
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400
                                         hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                              >
                                <EyeIcon size={14} />
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 
                   dark:hover:bg-gray-700 rounded-lg"
        >
          Close
        </button>
      </div>
    </Modal>

    {/* Transaction Details Modal */}
    {detailsModal && (
      <ValidationTransactionModal
        isOpen={detailsModal.isOpen}
        onClose={() => setDetailsModal(null)}
        title={detailsModal.title}
        transactionIds={detailsModal.transactionIds}
        issueType={detailsModal.issueType}
        onFixed={() => {
          // Close the modal to refresh the validation issues
          setDetailsModal(null);
        }}
      />
    )}

    {/* Fix Summary Modal */}
    <FixSummaryModal
      isOpen={showSummary}
      onClose={() => setShowSummary(false)}
      changes={changes}
      onUndo={handleUndo}
      onUndoAll={handleUndoAll}
    />

    {/* Balance Reconciliation Modal */}
    <BalanceReconciliationModal
      isOpen={!!reconciliationOption}
      onClose={() => {
        setReconciliationOption(null);
        setPendingFixes(null);
      }}
      option={reconciliationOption}
      onConfirm={handleReconciliationChoice}
    />
    </>
  );
}

