import React, { useEffect, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import type { Category } from '../types';

/**
 * A category's own properties, in one place.
 *
 * The page used to edit a category by turning its row into a bare text box, so
 * "name" was the only property a category appeared to have. It has another one
 * that changes what every report says: whether the money filed under it counts
 * as income and spending at all.
 *
 * That second property earns a dialog rather than a checkbox in the tree,
 * because it cannot be offered honestly without room to say what it does. A
 * transfer whose other side no longer exists, a correction, an opening
 * adjustment — money moved, but nobody earned or spent it. Marking the category
 * takes every transaction in it out of the income and expense totals, in every
 * report and every period, the moment it is saved. Silently flipping a checkbox
 * that restates a year of history is not a small control.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
  category: Category;
  /**
   * Transactions (split lines included) filed DIRECTLY on this category — not
   * the rolled-up figure the tree shows for a group. The flag applies to this
   * category alone, so this is the number that actually moves.
   */
  directTransactionCount: number;
  /** True when other categories sit under this one; they are NOT re-filed with it. */
  hasChildren: boolean;
  onSave: (updates: { name: string; isRevaluationCategory: boolean }) => Promise<void>;
}

/**
 * Why the adjustment toggle is not offered for this category — the sentence the
 * user sees — or null when it is. These are the categories the app files rows
 * under by itself, where the user's answer would be overwritten or would break
 * bookkeeping the app depends on.
 */
function adjustmentBlockedReason(category: Category): string | null {
  if (category.isTransferCategory === true) {
    return 'This is an account’s own transfer category. Transfers are already kept out of income and expenses, and the app manages this one from its account.';
  }
  if (category.isUnassignedBucket === true) {
    return 'Rows here are not categorised at all, so they are already outside every total. File them from the review band instead.';
  }
  if (category.isSystem === true) {
    return 'This is one of the app’s built-in categories and it already reports where it should.';
  }
  return null;
}

/** "£" is irrelevant here — this is a count of rows, not an amount. */
const formatCount = (value: number): string => value.toLocaleString();

export default function EditCategoryModal({
  isOpen,
  onClose,
  category,
  directTransactionCount,
  hasChildren,
  onSave,
}: Props): React.JSX.Element {
  const savedIsAdjustment = category.isRevaluationCategory === true;

  const [name, setName] = useState(category.name);
  const [isAdjustment, setIsAdjustment] = useState(savedIsAdjustment);
  const [isSaving, setIsSaving] = useState(false);
  const [problem, setProblem] = useState('');

  // Reopening on a different category must show THAT category, not whatever was
  // left in state from the last one.
  useEffect(() => {
    if (isOpen) {
      setName(category.name);
      setIsAdjustment(category.isRevaluationCategory === true);
      setProblem('');
      setIsSaving(false);
    }
  }, [isOpen, category.id, category.name, category.isRevaluationCategory]);

  const blocked = adjustmentBlockedReason(category);
  const trimmedName = name.trim();
  const adjustmentChanged = !blocked && isAdjustment !== savedIsAdjustment;
  const nameChanged = trimmedName !== '' && trimmedName !== category.name;
  const canSave = trimmedName !== '' && (nameChanged || adjustmentChanged) && !isSaving;

  // Where the money currently reports, in the words the report uses.
  const currentSide = category.type === 'income' ? 'Income' : 'Expenses';

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setIsSaving(true);
    setProblem('');
    try {
      await onSave({
        name: trimmedName,
        isRevaluationCategory: blocked ? savedIsAdjustment : isAdjustment,
      });
      onClose();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit category" size="lg">
      <ModalBody>
        <div className="space-y-6">
          <div>
            <label
              htmlFor="edit-category-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Name
            </label>
            <input
              id="edit-category-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave();
              }}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              How this category reports
            </h3>

            {blocked ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">{blocked}</p>
            ) : (
              <>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAdjustment}
                    onChange={(e) => setIsAdjustment(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 dark:border-gray-600 text-[var(--color-primary)]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">
                      This is an adjustment, not income or spending
                    </span>
                    <span className="block text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Money that moved but was neither earned nor spent — kept out of income and
                      expense totals, and reported under gains, losses and adjustments instead.
                      A transfer whose other account no longer exists is the usual case.
                    </span>
                  </span>
                </label>

                {/* The consequence, only once there IS one. A line about
                    re-filing zero transactions teaches people to skim. */}
                {adjustmentChanged && directTransactionCount > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
                    <p className="text-sm text-amber-900 dark:text-amber-200">
                      {isAdjustment ? (
                        <>
                          Saving re-files the {formatCount(directTransactionCount)}{' '}
                          {directTransactionCount === 1 ? 'transaction' : 'transactions'} in this
                          category out of {currentSide} and into gains, losses and adjustments —
                          in every report, for every period, back to the start of your history.
                        </>
                      ) : (
                        <>
                          Saving puts the {formatCount(directTransactionCount)}{' '}
                          {directTransactionCount === 1 ? 'transaction' : 'transactions'} in this
                          category back into your {currentSide} totals — in every report, for
                          every period, back to the start of your history.
                        </>
                      )}
                      {hasChildren && (
                        <> Categories underneath this one keep reporting as they do now.</>
                      )}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {problem && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
              <p className="text-sm text-red-800 dark:text-red-300">{problem}</p>
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={() => { void handleSave(); }}
            disabled={!canSave}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
