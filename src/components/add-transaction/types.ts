export interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface FormData {
  description: string;
  amount: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  subCategory: string;
  accountId: string;
  date: string;
  notes: string;
}

export interface ValidationErrors {
  [key: string]: string;
}