import React, { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Transaction, Account } from '../types';
import { TransactionRow } from './TransactionRow';

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
  renderHeaderCell
}: VirtualizedTransactionListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Calculate row height based on compact view
  const rowHeight = compactView ? 52 : 72;
  
  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5, // Render 5 items outside of the visible area
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Memoize the total size style
  const totalSizeStyle = useMemo(() => ({
    height: `${virtualizer.getTotalSize()}px`,
    width: '100%',
    position: 'relative' as const,
  }), [virtualizer.getTotalSize()]);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden border border-white/20 dark:border-gray-700/50">
      <table className="w-full" style={{ tableLayout: 'fixed' }}>
        <thead className="bg-secondary dark:bg-gray-700 border-b-2 border-[#5A729A] dark:border-gray-600 sticky top-0 z-10">
          <tr>
            {columnOrder.map(renderHeaderCell)}
          </tr>
        </thead>
      </table>
      
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight: '600px' }}
      >
        <div style={totalSizeStyle}>
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {virtualItems.map((virtualItem) => {
                const transaction = transactions[virtualItem.index];
                const account = accounts.find(a => a.id === transaction.accountId);
                const categoryPath = getCategoryPath(transaction.category);
                
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
                        />
                      </tbody>
                    </table>
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