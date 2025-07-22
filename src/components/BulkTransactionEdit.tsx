import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { Modal } from './common/Modal';
import { 
  EditIcon,
  CheckIcon,
  XIcon,
  TagIcon,
  FolderIcon,
  CalendarIcon,
  FileTextIcon,
  FilterIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  SearchIcon,
  SelectAllIcon,
  DeselectAllIcon
} from './icons';
import type { Transaction } from '../types';
import type { DecimalInstance } from '../types/decimal-types';
import { toDecimal } from '../utils/decimal';

interface BulkTransactionEditProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedIds?: string[];
}

interface BulkEditChanges {
  category?: string;
  tags?: string[];
  cleared?: boolean;
  notes?: string;
  moveToAccount?: string;
}

interface FilterOptions {
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  accounts: string[];
  categories: string[];
  types: ('income' | 'expense' | 'transfer')[];
  searchTerm: string;
  amountRange: {
    min: number | null;
    max: number | null;
  };
}

export default function BulkTransactionEdit({ 
  isOpen, 
  onClose,
  preSelectedIds = []
}: BulkTransactionEditProps) {
  const { transactions, accounts, categories, updateTransaction } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preSelectedIds));
  const [changes, setChanges] = useState<BulkEditChanges>({});
  const [showFilters, setShowFilters] = useState(false);
  const [applying, setApplying] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);
  
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: {
      start: null,
      end: null
    },
    accounts: [],
    categories: [],
    types: [],
    searchTerm: '',
    amountRange: {
      min: null,
      max: null
    }
  });

  // Filter transactions based on criteria
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Date filter
      if (filters.dateRange.start || filters.dateRange.end) {
        const tDate = t.date instanceof Date ? t.date : new Date(t.date);
        if (filters.dateRange.start && tDate < filters.dateRange.start) return false;
        if (filters.dateRange.end && tDate > filters.dateRange.end) return false;
      }
      
      // Account filter
      if (filters.accounts.length > 0 && !filters.accounts.includes(t.accountId)) {
        return false;
      }
      
      // Category filter
      if (filters.categories.length > 0 && !filters.categories.includes(t.category)) {
        return false;
      }
      
      // Type filter
      if (filters.types.length > 0 && !filters.types.includes(t.type as any)) {
        return false;
      }
      
      // Search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        if (!t.description.toLowerCase().includes(searchLower) &&
            !t.category.toLowerCase().includes(searchLower) &&
            !(t.notes && t.notes.toLowerCase().includes(searchLower)) &&
            !(t.tags && t.tags.some(tag => tag.toLowerCase().includes(searchLower)))) {
          return false;
        }
      }
      
      // Amount filter
      if (filters.amountRange.min !== null || filters.amountRange.max !== null) {
        const amount = typeof t.amount === 'number' ? t.amount : (t.amount as DecimalInstance).toNumber();
        if (filters.amountRange.min !== null && amount < filters.amountRange.min) return false;
        if (filters.amountRange.max !== null && amount > filters.amountRange.max) return false;
      }
      
      return true;
    });
  }, [transactions, filters]);

  const handleSelectAll = () => {
    const allIds = new Set(filteredTransactions.map(t => t.id));
    setSelectedIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleToggleTransaction = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleApplyChanges = async () => {
    if (selectedIds.size === 0 || Object.keys(changes).length === 0) return;
    
    setApplying(true);
    setAppliedCount(0);
    
    try {
      let count = 0;
      for (const id of selectedIds) {
        const transaction = transactions.find(t => t.id === id);
        if (!transaction) continue;
        
        const updates: Partial<Transaction> = {};
        
        if (changes.category !== undefined) {
          updates.category = changes.category;
        }
        
        if (changes.tags !== undefined) {
          updates.tags = changes.tags;
        }
        
        if (changes.cleared !== undefined) {
          updates.cleared = changes.cleared;
        }
        
        if (changes.notes !== undefined) {
          updates.notes = changes.notes;
        }
        
        if (changes.moveToAccount !== undefined) {
          updates.accountId = changes.moveToAccount;
        }
        
        await updateTransaction(id, updates);
        count++;
        setAppliedCount(count);
      }
      
      // Reset after successful update
      setSelectedIds(new Set());
      setChanges({});
      onClose();
    } catch (error) {
      console.error('Error applying bulk changes:', error);
    } finally {
      setApplying(false);
    }
  };

  const selectedTransactions = useMemo(() => {
    return filteredTransactions.filter(t => selectedIds.has(t.id));
  }, [filteredTransactions, selectedIds]);

  const commonCategory = useMemo(() => {
    if (selectedTransactions.length === 0) return null;
    const firstCategory = selectedTransactions[0].category;
    return selectedTransactions.every(t => t.category === firstCategory) ? firstCategory : null;
  }, [selectedTransactions]);

  const commonTags = useMemo(() => {
    if (selectedTransactions.length === 0) return [];
    const tagSets = selectedTransactions.map(t => new Set(t.tags || []));
    const intersection = tagSets.reduce((acc, set) => {
      return new Set([...acc].filter(x => set.has(x)));
    });
    return Array.from(intersection);
  }, [selectedTransactions]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Edit Transactions"
      size="full"
    >
      <div className="flex h-[80vh]">
        {/* Left Panel - Transaction List */}
        <div className="w-2/3 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Select Transactions</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm
                           ${showFilters 
                             ? 'bg-primary text-white' 
                             : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                           }`}
                >
                  <FilterIcon size={16} />
                  Filters
                </button>
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 px-3 py-1 text-sm text-gray-700 
                           dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  <CheckCircleIcon size={16} />
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="flex items-center gap-2 px-3 py-1 text-sm text-gray-700 
                           dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  <XIcon size={16} />
                  Clear
                </button>
              </div>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Date Range</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={filters.dateRange.start?.toISOString().split('T')[0] || ''}
                        onChange={(e) => setFilters({
                          ...filters,
                          dateRange: {
                            ...filters.dateRange,
                            start: e.target.value ? new Date(e.target.value) : null
                          }
                        })}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 
                                 rounded bg-white dark:bg-gray-700"
                      />
                      <span className="self-center">to</span>
                      <input
                        type="date"
                        value={filters.dateRange.end?.toISOString().split('T')[0] || ''}
                        onChange={(e) => setFilters({
                          ...filters,
                          dateRange: {
                            ...filters.dateRange,
                            end: e.target.value ? new Date(e.target.value) : null
                          }
                        })}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 
                                 rounded bg-white dark:bg-gray-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Search</label>
                    <input
                      type="text"
                      placeholder="Search descriptions, notes, tags..."
                      value={filters.searchTerm}
                      onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 
                               rounded bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Accounts</label>
                    <select
                      multiple
                      value={filters.accounts}
                      onChange={(e) => setFilters({
                        ...filters,
                        accounts: Array.from(e.target.selectedOptions, opt => opt.value)
                      })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 
                               rounded bg-white dark:bg-gray-700"
                      size={3}
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Categories</label>
                    <select
                      multiple
                      value={filters.categories}
                      onChange={(e) => setFilters({
                        ...filters,
                        categories: Array.from(e.target.selectedOptions, opt => opt.value)
                      })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 
                               rounded bg-white dark:bg-gray-700"
                      size={3}
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={filters.types.includes('income')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters({ ...filters, types: [...filters.types, 'income'] as any });
                            } else {
                              setFilters({ ...filters, types: filters.types.filter(t => t !== 'income') as any });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">Income</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={filters.types.includes('expense')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters({ ...filters, types: [...filters.types, 'expense'] as any });
                            } else {
                              setFilters({ ...filters, types: filters.types.filter(t => t !== 'expense') as any });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">Expense</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={filters.types.includes('transfer' as any)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters({ ...filters, types: [...filters.types, 'transfer' as any] });
                            } else {
                              setFilters({ ...filters, types: filters.types.filter(t => t !== 'transfer') as any });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">Transfer</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm text-gray-600 dark:text-gray-400">
              {selectedIds.size} of {filteredTransactions.length} transactions selected
            </div>
          </div>

          {/* Transaction List */}
          <div className="space-y-2">
            {filteredTransactions.map(transaction => {
              const tDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
              const account = accounts.find(a => a.id === transaction.accountId);
              
              return (
                <label
                  key={transaction.id}
                  className={`block p-3 rounded-lg border cursor-pointer transition-colors
                           ${selectedIds.has(transaction.id)
                             ? 'border-primary bg-primary/10'
                             : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                           }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(transaction.id)}
                      onChange={() => handleToggleTransaction(transaction.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{transaction.description}</div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <span className="flex items-center gap-1">
                              <CalendarIcon size={14} />
                              {tDate.toLocaleDateString()}
                            </span>
                            <span>{transaction.category}</span>
                            <span>{account?.name}</span>
                            {transaction.tags && transaction.tags.length > 0 && (
                              <span className="flex items-center gap-1">
                                <TagIcon size={14} />
                                {transaction.tags.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`font-medium ${
                          transaction.type === 'income' 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </div>
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Right Panel - Edit Options */}
        <div className="w-1/3 p-6">
          <h3 className="text-lg font-medium mb-4">Edit Selected Transactions</h3>
          
          {selectedIds.size === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Select transactions to edit
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Editing {selectedIds.size} transaction{selectedIds.size > 1 ? 's' : ''}
                </div>
                <div className="text-xs text-gray-500">
                  Total: {formatCurrency(
                    selectedTransactions.reduce((sum, t) => 
                      sum + (typeof t.amount === 'number' ? t.amount : (t.amount as DecimalInstance).toNumber()), 0
                    )
                  )}
                </div>
              </div>

              {/* Edit Fields */}
              <div className="space-y-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <FolderIcon size={16} className="inline mr-1" />
                    Category
                  </label>
                  <select
                    value={changes.category ?? commonCategory ?? ''}
                    onChange={(e) => setChanges({
                      ...changes,
                      category: e.target.value || undefined
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-800"
                  >
                    <option value="">Keep existing</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <TagIcon size={16} className="inline mr-1" />
                    Tags
                  </label>
                  <input
                    type="text"
                    placeholder="Enter tags separated by commas"
                    value={changes.tags?.join(', ') ?? commonTags.join(', ')}
                    onChange={(e) => setChanges({
                      ...changes,
                      tags: e.target.value ? e.target.value.split(',').map(t => t.trim()) : []
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-800"
                  />
                </div>

                {/* Cleared Status */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <CheckCircleIcon size={16} className="inline mr-1" />
                    Cleared Status
                  </label>
                  <select
                    value={changes.cleared !== undefined ? changes.cleared.toString() : ''}
                    onChange={(e) => setChanges({
                      ...changes,
                      cleared: e.target.value === '' ? undefined : e.target.value === 'true'
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-800"
                  >
                    <option value="">Keep existing</option>
                    <option value="true">Mark as Cleared</option>
                    <option value="false">Mark as Uncleared</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <FileTextIcon size={16} className="inline mr-1" />
                    Notes
                  </label>
                  <textarea
                    placeholder="Add notes to all selected transactions"
                    value={changes.notes ?? ''}
                    onChange={(e) => setChanges({
                      ...changes,
                      notes: e.target.value || undefined
                    })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-800"
                  />
                </div>

                {/* Move to Account */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <ArrowRightIcon size={16} className="inline mr-1" />
                    Move to Account
                  </label>
                  <select
                    value={changes.moveToAccount ?? ''}
                    onChange={(e) => setChanges({
                      ...changes,
                      moveToAccount: e.target.value || undefined
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-800"
                  >
                    <option value="">Keep in current account</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrency(acc.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Warning */}
              {Object.keys(changes).length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircleIcon className="text-orange-600 dark:text-orange-400 mt-0.5" size={16} />
                    <div className="text-sm text-orange-800 dark:text-orange-200">
                      These changes will be applied to all {selectedIds.size} selected transactions.
                      This action cannot be undone.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 
                   dark:hover:bg-gray-700 rounded-lg"
        >
          Cancel
        </button>
        <button
          onClick={handleApplyChanges}
          disabled={selectedIds.size === 0 || Object.keys(changes).length === 0 || applying}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                   hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {applying ? (
            <>
              <RefreshCwIcon size={20} className="animate-spin" />
              Applying ({appliedCount}/{selectedIds.size})...
            </>
          ) : (
            <>
              <CheckIcon size={20} />
              Apply Changes
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}

// Add missing imports
import { ArrowRightIcon, RefreshCwIcon } from './icons';