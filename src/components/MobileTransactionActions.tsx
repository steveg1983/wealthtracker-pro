import React from 'react';
import { ActionSheet, BottomSheet } from './BottomSheet';
import { useBottomSheet } from '../hooks/useBottomSheet';
import { 
  EditIcon, 
  DeleteIcon, 
  CopyIcon, 
  StarIcon as ShareIcon, 
  CheckCircleIcon,
  FolderIcon,
  GripVerticalIcon as MoreVerticalIcon
} from './icons';
import type { Transaction } from '../types';

interface MobileTransactionActionsProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onDuplicate: (transaction: Transaction) => void;
  onCategorize: (transaction: Transaction) => void;
  onReconcile?: (transaction: Transaction) => void;
  onShare?: (transaction: Transaction) => void;
}

/**
 * Mobile-optimized transaction actions using bottom sheets
 */
export function MobileTransactionActions({
  transaction,
  onEdit,
  onDelete,
  onDuplicate,
  onCategorize,
  onReconcile,
  onShare
}: MobileTransactionActionsProps): React.JSX.Element {
  const actionsSheet = useBottomSheet();
  const deleteSheet = useBottomSheet();
  const shareSheet = useBottomSheet();

  // Main actions
  const mainActions = [
    {
      icon: <EditIcon size={20} />,
      label: 'Edit Transaction',
      description: 'Modify details and amounts',
      onClick: () => onEdit(transaction)
    },
    {
      icon: <CopyIcon size={20} />,
      label: 'Duplicate',
      description: 'Create a copy of this transaction',
      onClick: () => onDuplicate(transaction)
    },
    {
      icon: <FolderIcon size={20} />,
      label: 'Change Category',
      description: `Current: ${transaction.category}`,
      onClick: () => onCategorize(transaction)
    }
  ];

  // Add reconcile if available
  if (onReconcile && !transaction.cleared) {
    mainActions.push({
      icon: <CheckCircleIcon size={20} />,
      label: 'Mark as Reconciled',
      description: 'Confirm this transaction has cleared',
      onClick: () => onReconcile(transaction)
    });
  }

  // Add share if available
  if (onShare) {
    mainActions.push({
      icon: <ShareIcon size={20} />,
      label: 'Share',
      description: 'Send transaction details',
      onClick: () => shareSheet.open()
    });
  }

  // Always add delete at the end
  mainActions.push({
    icon: <DeleteIcon size={20} />,
    label: 'Delete',
    description: 'Remove this transaction',
    onClick: () => deleteSheet.open()
  });

  // Share options
  const shareOptions = [
    {
      icon: <ShareIcon size={20} />,
      label: 'Share as Text',
      onClick: () => {
        const text = `${transaction.description}\n${transaction.amount}\n${transaction.date}`;
        if (navigator.share) {
          navigator.share({ text });
        }
      }
    },
    {
      icon: <CopyIcon size={20} />,
      label: 'Copy to Clipboard',
      onClick: () => {
        const text = `${transaction.description} - ${transaction.amount}`;
        navigator.clipboard.writeText(text);
      }
    }
  ];

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={actionsSheet.open}
        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        aria-label="Transaction actions"
      >
        <MoreVerticalIcon size={20} />
      </button>

      {/* Main Actions Sheet */}
      <ActionSheet
        isOpen={actionsSheet.isOpen}
        onClose={actionsSheet.close}
        title="Transaction Actions"
        actions={mainActions}
      />

      {/* Delete Confirmation Sheet */}
      <BottomSheet
        isOpen={deleteSheet.isOpen}
        onClose={deleteSheet.close}
        title="Delete Transaction?"
        height="auto"
        showHandle={false}
      >
        <div className="p-4">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Are you sure you want to delete this transaction? This action cannot be undone.
          </p>
          
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4">
            <p className="font-medium text-gray-900 dark:text-white">
              {transaction.description}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {transaction.amount} • {transaction.date}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                onDelete(transaction.id);
                deleteSheet.close();
              }}
              className="flex-1 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Transaction
            </button>
            <button
              onClick={deleteSheet.close}
              className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Share Sheet */}
      {onShare && (
       <ActionSheet
          isOpen={shareSheet.isOpen}
          onClose={shareSheet.close}
          title="Share Transaction"
          actions={shareOptions}
        />
      )}
    </>
  );
}

/**
 * Transaction Details Bottom Sheet
 */
export function TransactionDetailsSheet({
  transaction,
  isOpen,
  onClose,
  formatCurrency
}: {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
}) {
  if (!transaction) return null;

  const details = [
    { label: 'Description', value: transaction.description },
    { label: 'Amount', value: formatCurrency(transaction.amount) },
    { label: 'Date', value: transaction.date },
    { label: 'Category', value: transaction.category },
    { label: 'Account', value: transaction.accountId },
    { label: 'Status', value: transaction.cleared ? 'Cleared' : 'Pending' }
  ];

  if (transaction.notes) {
    details.push({ label: 'Notes', value: transaction.notes });
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Transaction Details"
      height="half"
      snapPoints={[30, 50, 90]}
      defaultSnapPoint={1}
    >
      <div className="p-4 space-y-4">
        {/* Amount highlight */}
        <div className="text-center py-4">
          <p className={`text-3xl font-bold ${
            transaction.amount < 0 
              ? 'text-red-600 dark:text-red-400' 
              : 'text-green-600 dark:text-green-400'
          }`}>
            {formatCurrency(transaction.amount)}
          </p>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {transaction.description}
          </p>
        </div>

        {/* Details list */}
        <div className="space-y-3">
          {details.map((detail, index) => (
            <div key={index} className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                {detail.label}
              </span>
              <span className="text-gray-900 dark:text-white font-medium">
                {detail.value}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-3">
            <button className="flex flex-col items-center gap-1 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <EditIcon size={20} className="text-gray-600 dark:text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Edit</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <CopyIcon size={20} className="text-gray-600 dark:text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Duplicate</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <ShareIcon size={20} className="text-gray-600 dark:text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Share</span>
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
