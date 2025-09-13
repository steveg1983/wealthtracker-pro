import { useCallback } from 'react';
import type { Transaction } from '../../types';
import type { DecimalTransaction, DecimalAccount, DecimalBudget } from '../../types/decimal-types';
import { toDecimalTransaction, fromDecimalTransaction } from '../../utils/decimal-converters';
import { toDecimal } from '../../utils/decimal';
import { smartCategorizationService } from '../../services/smartCategorizationService';

/**
 * Custom hook for transaction management operations
 * Handles CRUD operations for transactions with automatic categorization
 */
export function useTransactionManagement(
  decimalTransactions: DecimalTransaction[],
  setDecimalTransactions: React.Dispatch<React.SetStateAction<DecimalTransaction[]>>,
  decimalAccounts: DecimalAccount[],
  setDecimalAccounts: React.Dispatch<React.SetStateAction<DecimalAccount[]>>,
  decimalBudgets: DecimalBudget[],
  setDecimalBudgets: React.Dispatch<React.SetStateAction<DecimalBudget[]>>
) {
  const transactions = decimalTransactions.map(fromDecimalTransaction);

  const addTransaction = useCallback((transaction: Omit<Transaction, 'id'>) => {
    const fullTransaction = {
      ...transaction,
      id: crypto.randomUUID()
    } as Transaction;
    const suggestedCategory = smartCategorizationService.categorizeTransaction(fullTransaction);
    
    const decimalTransaction = toDecimalTransaction({
      ...transaction,
      id: crypto.randomUUID(),
      category: transaction.category || suggestedCategory || 'uncategorized'
    });
    
    setDecimalTransactions(prev => [...prev, decimalTransaction]);
    
    // Learn from manual categorization
    if (transaction.category && transaction.description) {
      smartCategorizationService.learnFromTransactions(
        [fullTransaction],
        []
      );
    }
    
    // Update account balance
    const accountId = transaction.accountId;
    if (accountId) {
      setDecimalAccounts(prev => prev.map(account => {
        if (account.id === accountId) {
          const newBalance = account.balance.plus(toDecimal(transaction.amount));
          return { ...account, balance: newBalance, lastUpdated: new Date() };
        }
        return account;
      }));
    }
    
    // Update budget spent amount
    const budgetCategory = transaction.category;
    const transactionMonth = new Date(transaction.date).toISOString().slice(0, 7);
    
    setDecimalBudgets(prev => prev.map(budget => {
      if (budget.category === budgetCategory && 
          budget.period === transactionMonth && 
          transaction.amount < 0) {
        const currentSpent = budget.spent || toDecimal(0);
        const newSpent = currentSpent.plus(toDecimal(Math.abs(transaction.amount)));
        return { ...budget, spent: newSpent };
      }
      return budget;
    }));
  }, [setDecimalTransactions, setDecimalAccounts, setDecimalBudgets]);

  const updateTransaction = useCallback((id: string, updates: Partial<Transaction>) => {
    const oldTransaction = decimalTransactions.find(t => t.id === id);
    if (!oldTransaction) return;
    
    setDecimalTransactions(prev => prev.map(transaction => 
      transaction.id === id 
        ? { ...transaction, ...toDecimalTransaction({ ...fromDecimalTransaction(transaction), ...updates }) }
        : transaction
    ));
    
    // Update account balances if amount or account changed
    if (updates.amount !== undefined || updates.accountId !== undefined) {
      const oldAmount = oldTransaction.amount;
      const newAmount = toDecimal(updates.amount ?? oldAmount.toNumber());
      const oldAccountId = oldTransaction.accountId;
      const newAccountId = updates.accountId ?? oldAccountId;
      
      setDecimalAccounts(prev => prev.map(account => {
        if (account.id === oldAccountId) {
          const adjustedBalance = account.balance.minus(oldAmount);
          if (oldAccountId === newAccountId) {
            return { 
              ...account, 
              balance: adjustedBalance.plus(newAmount),
              lastUpdated: new Date() 
            };
          }
          return { ...account, balance: adjustedBalance, lastUpdated: new Date() };
        }
        if (account.id === newAccountId && oldAccountId !== newAccountId) {
          return { 
            ...account, 
            balance: account.balance.plus(newAmount),
            lastUpdated: new Date() 
          };
        }
        return account;
      }));
    }
  }, [decimalTransactions, setDecimalTransactions, setDecimalAccounts]);

  const deleteTransaction = useCallback((id: string) => {
    const transaction = decimalTransactions.find(t => t.id === id);
    if (!transaction) return;
    
    setDecimalTransactions(prev => prev.filter(t => t.id !== id));
    
    // Update account balance
    if (transaction.accountId) {
      setDecimalAccounts(prev => prev.map(account => {
        if (account.id === transaction.accountId) {
          return { 
            ...account, 
            balance: account.balance.minus(transaction.amount),
            lastUpdated: new Date() 
          };
        }
        return account;
      }));
    }
    
    // Update budget spent amount
    if (transaction.amount.lessThan(0)) {
      const transactionMonth = new Date(transaction.date).toISOString().slice(0, 7);
      setDecimalBudgets(prev => prev.map(budget => {
        if (budget.category === transaction.category && budget.period === transactionMonth) {
          const currentSpent = budget.spent || toDecimal(0);
          const newSpent = currentSpent.minus(toDecimal(Math.abs(transaction.amount.toNumber())));
          return { ...budget, spent: newSpent };
        }
        return budget;
      }));
    }
  }, [decimalTransactions, setDecimalTransactions, setDecimalAccounts, setDecimalBudgets]);

  return {
    transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction
  };
}