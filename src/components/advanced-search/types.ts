import type { Transaction, Account } from '../../types';

export interface SearchFilter {
  id: string;
  label: string;
  type: 'text' | 'date' | 'amount' | 'select' | 'multiselect';
  field: string;
  value: string | string[] | number | boolean | null;
  options?: { value: string; label: string }[];
}

export interface AdvancedSearchProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: { id: string; name: string }[];
  onResults: (results: Transaction[]) => void;
  className?: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilter[];
  createdAt: Date;
}

export const createDefaultFilters = (
  categories: { id: string; name: string }[],
  accounts: Account[]
): SearchFilter[] => [
  {
    id: 'description',
    label: 'Description',
    type: 'text',
    field: 'description',
    value: ''
  },
  {
    id: 'category',
    label: 'Category',
    type: 'multiselect',
    field: 'category',
    value: [],
    options: categories.map(cat => ({ value: cat.id, label: cat.name }))
  },
  {
    id: 'account',
    label: 'Account',
    type: 'multiselect',
    field: 'accountId',
    value: [],
    options: accounts.map(acc => ({ value: acc.id, label: acc.name }))
  },
  {
    id: 'amount_min',
    label: 'Min Amount',
    type: 'amount',
    field: 'amount',
    value: ''
  },
  {
    id: 'amount_max',
    label: 'Max Amount',
    type: 'amount',
    field: 'amount',
    value: ''
  },
  {
    id: 'date_from',
    label: 'From Date',
    type: 'date',
    field: 'date',
    value: ''
  },
  {
    id: 'date_to',
    label: 'To Date',
    type: 'date',
    field: 'date',
    value: ''
  },
  {
    id: 'type',
    label: 'Type',
    type: 'select',
    field: 'type',
    value: '',
    options: [
      { value: '', label: 'All Types' },
      { value: 'income', label: 'Income' },
      { value: 'expense', label: 'Expense' },
      { value: 'transfer', label: 'Transfer' }
    ]
  },
  {
    id: 'cleared',
    label: 'Status',
    type: 'select',
    field: 'cleared',
    value: '',
    options: [
      { value: '', label: 'All' },
      { value: 'true', label: 'Cleared' },
      { value: 'false', label: 'Uncleared' }
    ]
  }
];