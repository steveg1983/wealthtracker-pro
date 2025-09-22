import type { Transaction } from '../../types';

export interface FilterPreset {
  id: string;
  name: string;
  icon: React.ReactNode;
  filter: (transaction: Transaction) => boolean;
  description?: string;
  isCustom?: boolean;
  searchQuery?: string;
  dateRange?: { start: Date | null; end: Date | null };
  categories?: string[];
  accounts?: string[];
  amountRange?: { min: number | null; max: number | null };
  types?: ('income' | 'expense' | 'transfer')[];
}

export interface QuickFiltersProps {
  onFilterChange: (filter: (transaction: Transaction) => boolean) => void;
  onSearchChange?: (query: string) => void;
  transactions: Transaction[];
  compact?: boolean;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Partial<FilterPreset>;
  createdAt: Date;
  usageCount: number;
}

export interface CustomFilterFormData {
  name: string;
  dateRange: { start: Date | null; end: Date | null };
  categories: string[];
  accounts: string[];
  amountRange: { min: number | null; max: number | null };
  types: ('income' | 'expense' | 'transfer')[];
}