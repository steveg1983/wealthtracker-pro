import { useContext } from 'react';
import { TransactionContext } from './transaction-context-base';
import type { TransactionContextType } from './transaction-context-base';

export function useTransactions(): TransactionContextType {
  const context = useContext(TransactionContext);

  if (!context) {
    throw new Error('useTransactions must be used within a TransactionProvider');
  }

  return context;
}
