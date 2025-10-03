export interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface AccountFormData {
  name: string;
  type: 'current' | 'checking' | 'savings' | 'credit' | 'loan' | 'investment' | 'assets' | 'other';
  balance: string;
  currency: string;
  institution: string;
  sortCode: string;
  accountNumber: string;
}

export interface ValidationErrors {
  name?: string;
  bankDetails?: string;
}

export interface AccountType {
  value: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
}

export interface Currency {
  value: string;
  label: string;
  symbol: string;
}

export const accountTypes: AccountType[] = [
  { value: 'current', label: 'Current Account', icon: null as any, description: 'Everyday spending account' },
  { value: 'savings', label: 'Savings Account', icon: null as any, description: 'Long-term savings' },
  { value: 'credit', label: 'Credit Card', icon: null as any, description: 'Credit line account' },
  { value: 'loan', label: 'Loan', icon: null as any, description: 'Mortgages, personal loans' },
  { value: 'investment', label: 'Investment', icon: null as any, description: 'Stocks, bonds, funds' },
  { value: 'assets', label: 'Other Assets', icon: null as any, description: 'Property, valuables' },
];

export const currencies: Currency[] = [
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
];