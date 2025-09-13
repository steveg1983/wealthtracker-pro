import type { Transaction } from '../../types';

export interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

export interface FormData {
  date: string;
  description: string;
  amount: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  subCategory: string;
  accountId: string;
  tags: string[];
  notes: string;
  cleared: boolean;
  reconciledWith: string;
}

export interface ValidationErrors {
  [key: string]: string;
}

export const getInitialFormData = (
  transaction: Transaction | null,
  accounts: any[]
): FormData => {
  if (transaction) {
    return {
      date: transaction.date instanceof Date 
        ? transaction.date.toISOString().split('T')[0] 
        : new Date(transaction.date).toISOString().split('T')[0],
      description: transaction.description,
      amount: transaction.type === 'transfer' 
        ? transaction.amount.toString() 
        : Math.abs(transaction.amount).toString(),
      type: transaction.type,
      category: '',
      subCategory: '',
      accountId: transaction.accountId,
      tags: transaction.tags || [],
      notes: transaction.notes || '',
      cleared: transaction.cleared || false,
      reconciledWith: transaction.reconciledWith || ''
    };
  }
  
  return {
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'expense',
    category: '',
    subCategory: '',
    accountId: accounts.length > 0 ? accounts[0].id : '',
    tags: [],
    notes: '',
    cleared: false,
    reconciledWith: ''
  };
};