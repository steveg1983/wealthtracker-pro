import { DataService } from '../api/dataService';
import { logger } from '../loggingService';
import { sanitizeText } from '../../security/xss-protection';
import { formatCurrency } from '../../utils/formatters';
import type { Transaction } from '../../types';

export class TransactionOperations {
  static async addTransaction(
    transaction: Omit<Transaction, 'id'>,
    onAccountUpdate?: (updatedAccounts: any[]) => Promise<void>
  ): Promise<Transaction> {
    try {
      const sanitizedTransaction = {
        ...transaction,
        description: sanitizeText(transaction.description),
        notes: transaction.notes ? sanitizeText(transaction.notes) : undefined,
        tags: transaction.tags?.map(tag => sanitizeText(tag))
      };

      const newTransaction = await DataService.createTransaction(sanitizedTransaction);
      logger.debug('[TransactionOps] Transaction added:', { 
        id: newTransaction.id,
        amount: formatCurrency(newTransaction.amount) 
      });

      // Update accounts after transaction
      if (onAccountUpdate) {
        const updatedAccounts = await DataService.getAccounts();
        await onAccountUpdate(updatedAccounts);
      }

      return newTransaction;
    } catch (error) {
      logger.error('[TransactionOps] Failed to add transaction:', error);
      throw error;
    }
  }

  static async updateTransaction(
    id: string,
    updates: Partial<Transaction>,
    onAccountUpdate?: (updatedAccounts: any[]) => Promise<void>
  ): Promise<Transaction> {
    try {
      const sanitizedUpdates = {
        ...updates,
        description: updates.description ? sanitizeText(updates.description) : undefined,
        notes: updates.notes ? sanitizeText(updates.notes) : undefined,
        tags: updates.tags?.map(tag => sanitizeText(tag))
      };

      const updatedTransaction = await DataService.updateTransaction(id, sanitizedUpdates);
      logger.debug('[TransactionOps] Transaction updated:', { id });

      // Update accounts after transaction update
      if (onAccountUpdate) {
        const updatedAccounts = await DataService.getAccounts();
        await onAccountUpdate(updatedAccounts);
      }

      return updatedTransaction;
    } catch (error) {
      logger.error('[TransactionOps] Failed to update transaction:', error);
      throw error;
    }
  }

  static async deleteTransaction(
    id: string,
    onAccountUpdate?: (updatedAccounts: any[]) => Promise<void>
  ): Promise<void> {
    try {
      await DataService.deleteTransaction(id);
      logger.debug('[TransactionOps] Transaction deleted:', { id });

      // Update accounts after transaction deletion
      if (onAccountUpdate) {
        const updatedAccounts = await DataService.getAccounts();
        await onAccountUpdate(updatedAccounts);
      }
    } catch (error) {
      logger.error('[TransactionOps] Failed to delete transaction:', error);
      throw error;
    }
  }

  static async getTransactions(): Promise<Transaction[]> {
    try {
      const transactions = await DataService.getTransactions();
      logger.debug('[TransactionOps] Transactions loaded:', { count: transactions.length });
      return transactions;
    } catch (error) {
      logger.error('[TransactionOps] Failed to get transactions:', error);
      throw error;
    }
  }

  static subscribeToUpdates(
    onUpdate: (payload: any) => void
  ): () => void {
    return DataService.subscribeToUpdates({
      onTransactionUpdate: onUpdate
    });
  }
}