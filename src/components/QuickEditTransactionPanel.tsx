import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { usePayeeMemory } from '../hooks/usePayeeMemory';
import { XIcon } from './icons';
import CategorySelector from './CategorySelector';
import type { Transaction } from '../types';

interface QuickEditTransactionPanelProps {
  transaction: Transaction;
  /** Advance the selection to the next transaction in the visible list. */
  onNext?: () => void;
  onClose: () => void;
}

/**
 * One-click batch editor: single-clicking a row in the account register pins
 * this condensed editor under the table — date, description, category, save —
 * so a fresh bank import can be categorised without opening the full modal
 * for every transaction. "Save & Next" walks straight down the list.
 */
export default function QuickEditTransactionPanel({
  transaction,
  onNext,
  onClose,
}: QuickEditTransactionPanelProps): React.JSX.Element {
  const { categories, updateTransaction } = useApp();
  const { showError } = useToast();
  const { propagateCategory } = usePayeeMemory();

  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Re-sync only when a DIFFERENT transaction is selected (Save & Next flow).
  // Keyed by id, not object identity: context refreshes recreate the object
  // and must not clobber what the user is mid-way through typing.
  const lastSyncedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastSyncedIdRef.current === transaction.id) {
      return;
    }
    lastSyncedIdRef.current = transaction.id;
    const d = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
    setDate(d.toISOString().split('T')[0]);
    setDescription(transaction.description);
    setCategory(transaction.category ?? '');
  }, [transaction]);

  const isTransfer = transaction.type === 'transfer';

  const save = async (advance: boolean) => {
    if (isSaving) return;
    if (!description.trim()) {
      showError(new Error('Description is required.'));
      return;
    }
    const parsedDate = new Date(date);
    if (!date || Number.isNaN(parsedDate.getTime())) {
      showError(new Error('Enter a valid date.'));
      return;
    }
    setIsSaving(true);
    try {
      const categoryChanged = category !== (transaction.category ?? '');
      await updateTransaction(transaction.id, {
        date: parsedDate,
        description: description.trim(),
        ...(isTransfer ? {} : { category }),
      });

      // Payee memory — but never for CROSS-TYPE filings (a refund put under an
      // expense category is a one-off correction; teaching it to a mixed-flow
      // payee would stamp expense categories onto all its incoming money).
      const chosenCategory = categories.find(c => c.id === category);
      const isCrossType =
        chosenCategory !== undefined &&
        (chosenCategory.type === 'income' || chosenCategory.type === 'expense') &&
        chosenCategory.type !== transaction.type;

      if (!isTransfer && categoryChanged && category && !isCrossType &&
          (transaction.type === 'income' || transaction.type === 'expense')) {
        await propagateCategory({
          accountId: transaction.accountId,
          description: description.trim(),
          type: transaction.type,
          categoryId: category,
          excludeId: transaction.id,
        });
      }

      if (advance && onNext) {
        onNext();
      }
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // data-quick-edit-panel: the register's click-outside-to-deselect handler
    // treats clicks inside this panel as "keep the selection".
    <div data-quick-edit-panel className="mt-3 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 px-4 py-3">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex items-center gap-2 lg:hidden">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Quick edit</span>
        </div>

        {/* Date */}
        <div className="w-full lg:w-40">
          <label htmlFor="quick-edit-date" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Date
          </label>
          <input
            id="quick-edit-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 h-[42px] text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl dark:text-white"
          />
        </div>

        {/* Description */}
        <div className="flex-1 min-w-0">
          <label htmlFor="quick-edit-description" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Description
          </label>
          <input
            id="quick-edit-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 h-[42px] text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl dark:text-white"
          />
        </div>

        {/* Category (not editable for transfers — they carry system categories).
            Searchable combobox: click to type-filter, or use the chevron to
            browse the full list. Both directions are offered (Money-style
            cross-type filing — a refund can file under the expense it refunds). */}
        <div className="w-full lg:w-72">
          <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Category
          </span>
          {isTransfer ? (
            <div className="w-full px-3 h-[42px] flex items-center text-sm bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-xl text-gray-500 dark:text-gray-400">
              Transfer
            </div>
          ) : (
            <CategorySelector
              selectedCategory={category}
              onCategoryChange={setCategory}
              transactionType={transaction.type}
              includeAllTypes
              showHelperText={false}
              placeholder="Search or select category…"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => void save(false)}
            disabled={isSaving}
            className="px-4 h-[42px] inline-flex items-center justify-center text-sm font-medium bg-[#1a2332] text-white rounded-xl hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          {onNext && (
            <button
              onClick={() => void save(true)}
              disabled={isSaving}
              className="px-4 h-[42px] inline-flex items-center justify-center text-sm font-medium bg-[#2d3a4d] text-white rounded-xl hover:bg-[#3a4a5f] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title="Save and move to the next transaction in the list"
            >
              Save &amp; Next
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close quick edit"
          >
            <XIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
