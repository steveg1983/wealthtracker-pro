import React, { useEffect, memo, useMemo } from 'react';
import { 
  FolderIcon, 
  TagIcon, 
  CheckCircleIcon, 
  FileTextIcon, 
  ArrowRightIcon,
  EyeIcon,
  AlertCircleIcon
} from '../icons';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';
import type { Transaction, Account, Category } from '../../types';
import type { DecimalInstance } from '../../types/decimal-types';
import { logger } from '../../services/loggingService';

export interface BulkEditChanges {
  category?: string;
  tags?: string[];
  cleared?: boolean;
  notes?: string;
  moveToAccount?: string;
  appendNote?: boolean;
}

interface EditOptionsPanelProps {
  selectedTransactions: Transaction[];
  changes: BulkEditChanges;
  onChangesUpdate: (changes: BulkEditChanges) => void;
  categories: Category[];
  accounts: Account[];
  showPreview: boolean;
  onTogglePreview: () => void;
}

export const EditOptionsPanel = memo(function EditOptionsPanel({
  selectedTransactions,
  changes,
  onChangesUpdate,
  categories,
  accounts,
  showPreview,
  onTogglePreview
}: EditOptionsPanelProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('EditOptionsPanel component initialized', {
      componentName: 'EditOptionsPanel'
    });
  }, []);

  const { formatCurrency } = useCurrencyDecimal();

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

  const getPreviewChanges = useMemo(() => {
    const previews: { transaction: Transaction; updates: string[] }[] = [];
    
    selectedTransactions.forEach(transaction => {
      const updates: string[] = [];
      
      if (changes.category !== undefined && changes.category !== transaction.category) {
        updates.push(`Category → ${changes.category || 'Uncategorized'}`);
      }
      
      if (changes.tags !== undefined) {
        updates.push(`Tags → ${changes.tags.join(', ') || 'None'}`);
      }
      
      if (changes.cleared !== undefined && changes.cleared !== transaction.cleared) {
        updates.push(`Cleared → ${changes.cleared ? 'Yes' : 'No'}`);
      }
      
      if (changes.notes !== undefined) {
        if (changes.appendNote) {
          updates.push(`Note → Append "${changes.notes}"`);
        } else {
          updates.push(`Note → "${changes.notes}"`);
        }
      }
      
      if (changes.moveToAccount !== undefined && changes.moveToAccount !== transaction.accountId) {
        const account = accounts.find(a => a.id === changes.moveToAccount);
        updates.push(`Account → ${account?.name || 'Unknown'}`);
      }
      
      if (updates.length > 0) {
        previews.push({ transaction, updates });
      }
    });
    
    return previews;
  }, [selectedTransactions, changes, accounts]);

  if (selectedTransactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Select transactions to edit
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Editing {selectedTransactions.length} transaction{selectedTransactions.length > 1 ? 's' : ''}
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
            onChange={(e) => onChangesUpdate({
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
            onChange={(e) => onChangesUpdate({
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
            onChange={(e) => onChangesUpdate({
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
            onChange={(e) => onChangesUpdate({
              ...changes,
              notes: e.target.value || undefined
            })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800"
          />
          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={changes.appendNote || false}
              onChange={(e) => onChangesUpdate({
                ...changes,
                appendNote: e.target.checked
              })}
              className="rounded"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Append to existing notes instead of replacing
            </span>
          </label>
        </div>

        {/* Move to Account */}
        <div>
          <label className="block text-sm font-medium mb-2">
            <ArrowRightIcon size={16} className="inline mr-1" />
            Move to Account
          </label>
          <select
            value={changes.moveToAccount ?? ''}
            onChange={(e) => onChangesUpdate({
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

      {/* Preview Section */}
      {Object.keys(changes).filter(k => k !== 'appendNote').length > 0 && (
        <div className="space-y-3">
          <button
            onClick={onTogglePreview}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300"
          >
            <EyeIcon size={16} />
            {showPreview ? 'Hide' : 'Show'} preview of changes
          </button>
          
          {showPreview && getPreviewChanges.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 max-h-48 overflow-y-auto">
              <div className="space-y-2 text-xs">
                {getPreviewChanges.slice(0, 5).map(({ transaction, updates }) => (
                  <div key={transaction.id} className="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-2 last:pb-0">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {transaction.description}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 mt-1">
                      {updates.join(' • ')}
                    </div>
                  </div>
                ))}
                {getPreviewChanges.length > 5 && (
                  <div className="text-gray-500 dark:text-gray-400 italic">
                    ...and {getPreviewChanges.length - 5} more transactions
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Warning */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircleIcon className="text-orange-600 dark:text-orange-400 mt-0.5" size={16} />
              <div className="text-sm text-orange-800 dark:text-orange-200">
                These changes will be applied to all {selectedTransactions.length} selected transactions.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});