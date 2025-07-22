import React from 'react';
import { Transaction, Category } from '../types';
import { useBulkOperations } from '../hooks/useBulkOperations';
import { useApp } from '../contexts/AppContext';
import BulkOperationsToolbar from './BulkOperationsToolbar';
import BulkCheckbox from './BulkCheckbox';
import { DeleteIcon, EditIcon, CheckIcon, TagIcon } from './icons';

interface TransactionsBulkOperationsProps {
  transactions: Transaction[];
  children: (props: {
    selectedCount: number;
    isSelected: (id: string) => boolean;
    toggleItem: (id: string) => void;
    toggleAll: () => void;
    allSelected: boolean;
    someSelected: boolean;
    renderToolbar: () => React.ReactNode;
    renderCheckbox: (transaction: Transaction) => React.ReactNode;
  }) => React.ReactNode;
}

export default function TransactionsBulkOperations({
  transactions,
  children,
}: TransactionsBulkOperationsProps): React.JSX.Element {
  const { deleteTransaction, updateTransaction, categories } = useApp();

  const bulkOperations = [
    {
      id: 'delete',
      label: 'Delete',
      icon: DeleteIcon,
      action: async (items: Transaction[]) => {
        // Delete all selected transactions
        for (const transaction of items) {
          deleteTransaction(transaction.id);
        }
      },
      requiresConfirmation: true,
      confirmationMessage: `Are you sure you want to delete ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}? This action cannot be undone.`,
      destructive: true,
    },
    {
      id: 'mark-cleared',
      label: 'Mark as Cleared',
      icon: CheckIcon,
      action: async (items: Transaction[]) => {
        // Mark all selected transactions as cleared
        for (const transaction of items) {
          updateTransaction(transaction.id, {
            cleared: true,
          });
        }
      },
    },
    {
      id: 'mark-uncleared',
      label: 'Mark as Uncleared',
      icon: CheckIcon,
      action: async (items: Transaction[]) => {
        // Mark all selected transactions as uncleared
        for (const transaction of items) {
          updateTransaction(transaction.id, {
            cleared: false,
          });
        }
      },
    },
    {
      id: 'categorize',
      label: 'Categorize',
      icon: TagIcon,
      action: async (items: Transaction[]) => {
        // This would open a category selection dialog
        // For now, we'll just show an alert
        const category = prompt('Enter category ID:', 'groceries');
        if (category && categories.find((cat: Category) => cat.id === category)) {
          for (const transaction of items) {
            updateTransaction(transaction.id, {
              category,
            });
          }
        }
      },
    },
  ];

  const {
    selectedCount,
    allSelected,
    someSelected,
    isSelected,
    toggleItem,
    toggleAll,
    executeOperation,
    deselectAll,
    availableOperations,
    isProcessing,
  } = useBulkOperations(transactions, bulkOperations);

  const renderToolbar = (): React.JSX.Element => (
    <BulkOperationsToolbar
      selectedCount={selectedCount}
      availableOperations={availableOperations}
      onExecuteOperation={executeOperation}
      onDeselectAll={deselectAll}
      isProcessing={isProcessing}
    />
  );

  const renderCheckbox = (transaction: Transaction): React.JSX.Element => (
    <BulkCheckbox
      checked={isSelected(transaction.id)}
      onChange={() => toggleItem(transaction.id)}
      disabled={isProcessing}
      size="sm"
    />
  );

  return (
    <>
      {children({
        selectedCount,
        isSelected,
        toggleItem,
        toggleAll,
        allSelected,
        someSelected,
        renderToolbar,
        renderCheckbox,
      })}
    </>
  );
}