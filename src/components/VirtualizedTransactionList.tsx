import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Transaction, Account, Category } from '../types';
import { TransactionRow } from './TransactionRow';
import { CheckIcon, SelectAllIcon, DeselectAllIcon } from './icons';
import { IconButton } from './icons/IconButton';
import CategorySuggestion from './CategorySuggestion';
import { smartCategorizationService } from '../services/smartCategorizationService';
import { useApp } from '../contexts/AppContext';

interface VirtualizedTransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  getCategoryPath: (categoryId: string) => string;
  compactView: boolean;
  formatCurrency: (amount: number, currency?: string) => string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  renderHeaderCell: (column: string) => React.ReactNode;
  selectedTransactions?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  enableBulkSelection?: boolean;
  height?: number;
}

export const VirtualizedTransactionList = React.memo(function VirtualizedTransactionList({
  transactions,
  accounts,
  getCategoryPath,
  compactView,
  formatCurrency,
  onEdit,
  onDelete,
  columnOrder,
  columnWidths,
  renderHeaderCell,
  selectedTransactions = new Set(),
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  enableBulkSelection = false,
  height = 600
}: VirtualizedTransactionListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { categories, updateTransaction } = useApp();
  const [suggestions, setSuggestions] = useState<Map<string, any[]>>(new Map());
  
  // Generate suggestions for uncategorized transactions
  useEffect(() => {
    const newSuggestions = new Map<string, any[]>();
    
    // Learn patterns from existing transactions
    smartCategorizationService.learnFromTransactions(transactions, categories);
    
    // Generate suggestions for uncategorized transactions
    transactions.forEach(transaction => {
      if (!transaction.category) {
        const suggestionList = smartCategorizationService.suggestCategories(transaction, 3);
        if (suggestionList.length > 0) {
          newSuggestions.set(transaction.id, suggestionList);
        }
      }
    });
    
    setSuggestions(newSuggestions);
  }, [transactions, categories]);
  
  // Handle accepting a category suggestion
  const handleAcceptSuggestion = useCallback((transactionId: string, categoryId: string) => {
    updateTransaction(transactionId, { category: categoryId });
    
    // Remove suggestion after accepting
    setSuggestions(prev => {
      const newMap = new Map(prev);
      newMap.delete(transactionId);
      return newMap;
    });
  }, [updateTransaction]);
  
  // Calculate row height based on compact view and whether transaction has suggestions
  const getRowHeight = useCallback((index: number) => {
    const transaction = transactions[index];
    const hasSuggestion = suggestions.has(transaction.id) && !transaction.category;
    
    if (compactView) {
      return hasSuggestion ? 72 : 52;
    } else {
      return hasSuggestion ? 96 : 72;
    }
  }, [transactions, suggestions, compactView]);
  
  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getRowHeight,
    overscan: 10, // Increased overscan for smoother scrolling
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Memoize the total size style
  const totalSizeStyle = useMemo(() => ({
    height: `${virtualizer.getTotalSize()}px`,
    width: '100%',
    position: 'relative' as const,
  }), [virtualizer.getTotalSize()]);

  // Bulk selection handlers
  const handleSelectAll = useCallback(() => {
    if (onSelectAll) onSelectAll();
  }, [onSelectAll]);

  const handleDeselectAll = useCallback(() => {
    if (onDeselectAll) onDeselectAll();
  }, [onDeselectAll]);

  const isAllSelected = useMemo(() => {
    return transactions.length > 0 && transactions.every(t => selectedTransactions.has(t.id));
  }, [transactions, selectedTransactions]);

  const someSelected = useMemo(() => {
    return selectedTransactions.size > 0;
  }, [selectedTransactions]);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden border border-white/20 dark:border-gray-700/50">
      {/* Bulk Selection Header */}
      {enableBulkSelection && (
        <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedTransactions.size} of {transactions.length} selected
            </span>
            <div className="flex items-center gap-2">
              <IconButton
                onClick={handleSelectAll}
                icon={<SelectAllIcon size={16} />}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                title="Select all"
                disabled={isAllSelected}
              />
              <IconButton
                onClick={handleDeselectAll}
                icon={<DeselectAllIcon size={16} />}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                title="Deselect all"
                disabled={!someSelected}
              />
            </div>
          </div>
          {someSelected && (
            <div className="text-sm text-primary font-medium">
              {selectedTransactions.size} transactions selected
            </div>
          )}
        </div>
      )}
      
      <table className="w-full" style={{ tableLayout: 'fixed' }}>
        <thead className="bg-secondary dark:bg-gray-700 border-b-2 border-[#5A729A] dark:border-gray-600 sticky top-0 z-10">
          <tr>
            {enableBulkSelection && (
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={isAllSelected ? handleDeselectAll : handleSelectAll}
                  className="rounded text-primary focus:ring-primary"
                />
              </th>
            )}
            {columnOrder.map(renderHeaderCell)}
          </tr>
        </thead>
      </table>
      
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: `${height}px` }}
      >
        <div style={totalSizeStyle}>
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {virtualItems.map((virtualItem) => {
                const transaction = transactions[virtualItem.index];
                const account = accounts.find(a => a.id === transaction.accountId);
                const categoryPath = getCategoryPath(transaction.category);
                
                const transactionSuggestions = suggestions.get(transaction.id) || [];
                
                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <table className="w-full" style={{ tableLayout: 'fixed' }}>
                      <tbody>
                        <TransactionRow
                          transaction={transaction}
                          account={account}
                          categoryPath={categoryPath}
                          compactView={compactView}
                          formatCurrency={formatCurrency}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          columnOrder={columnOrder}
                          columnWidths={columnWidths}
                          isSelected={selectedTransactions.has(transaction.id)}
                          onToggleSelection={onToggleSelection}
                          enableBulkSelection={enableBulkSelection}
                        />
                      </tbody>
                    </table>
                    {transactionSuggestions.length > 0 && !transaction.category && (
                      <div className="px-4 pb-2">
                        <CategorySuggestion
                          transaction={transaction}
                          suggestions={transactionSuggestions}
                          onAccept={(categoryId) => handleAcceptSuggestion(transaction.id, categoryId)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});