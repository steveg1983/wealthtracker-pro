import { useEffect, useId, useMemo } from "react";
import { useApp } from "../contexts/AppContextSupabase";
import type { Goal } from "../types";
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import MoneyInput from './common/MoneyInput';
import { useModalForm } from '../hooks/useModalForm';
import { parseMoneyInput } from '../utils/decimal';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal?: Goal;
}

interface FormData {
  name: string;
  type: Goal["type"];
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
  description: string;
  linkedAccountIds: string[];
  isActive: boolean;
}

const inputClasses =
  "w-full px-3 py-2 bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white";

export default function GoalModal({ isOpen, onClose, goal }: GoalModalProps): React.JSX.Element {
  const { addGoal, updateGoal, accounts } = useApp();
  const fieldId = useId();

  const { formData, updateField, handleSubmit, setFormData, errors, isSubmitting } = useModalForm<FormData>(
    {
      name: "",
      type: "savings",
      targetAmount: "",
      currentAmount: "",
      targetDate: "",
      description: "",
      linkedAccountIds: [],
      isActive: true,
    },
    {
      onSubmit: async (data) => {
        const now = new Date();
        const goalData = {
          name: data.name,
          type: data.type,
          targetAmount: parseMoneyInput(data.targetAmount) ?? 0,
          currentAmount: parseMoneyInput(data.currentAmount) ?? 0,
          targetDate: new Date(data.targetDate),
          // '' rather than undefined: an undefined field is "leave it alone",
          // so clearing the description used to leave the old text in place.
          description: data.description.trim(),
          // Always the full array, empty included — sending undefined when the
          // last link is removed means "no change", and the links come back.
          linkedAccountIds: data.linkedAccountIds,
          isActive: data.isActive,
          // The "Active goal" checkbox pauses and resumes; it does not
          // un-achieve a goal that has already been reached.
          status: goalStatusFor(data.isActive, goal?.status),
          createdAt: goal?.createdAt || now,
          updatedAt: now
        };

        // Awaited: a save that fails must keep the modal open with the reason
        // on screen, not close as though the goal had been stored.
        if (goal) {
          await updateGoal(goal.id, goalData);
        } else {
          await addGoal(goalData);
        }
      },
      onClose
    }
  );

  useEffect(() => {
    if (goal) {
      // Handle targetDate whether it's a Date object or string
      let targetDateString = "";
      if (goal.targetDate) {
        if (goal.targetDate instanceof Date) {
          targetDateString = goal.targetDate.toISOString().split("T")[0];
        } else {
          // If it's already a string, ensure it's in YYYY-MM-DD format
          const dateStr = String(goal.targetDate);
          targetDateString = dateStr.split("T")[0];
        }
      }

      setFormData({
        name: goal.name,
        type: goal.type,
        targetAmount: goal.targetAmount.toString(),
        currentAmount: goal.currentAmount.toString(),
        targetDate: targetDateString,
        description: goal.description || "",
        linkedAccountIds: goal.linkedAccountIds || [],
        isActive: goal.isActive,
      });
    } else {
      setFormData({
        name: "",
        type: "savings",
        targetAmount: "",
        currentAmount: "",
        targetDate: "",
        description: "",
        linkedAccountIds: [],
        isActive: true,
      });
    }
  }, [goal, isOpen, setFormData]);

  // Only accounts that still exist and are still open can be linked. Anything
  // else the goal points at is shown below as unavailable rather than being
  // quietly dropped from the list — see `unavailableLinkedIds`.
  const linkableAccounts = useMemo(
    () => accounts.filter(account => account.isActive !== false),
    [accounts]
  );

  /**
   * Linked ids with no open account behind them: a deleted account, or one the
   * user has since closed. They keep their place in the goal (removing a link
   * is the user's decision, not ours) but cannot contribute a balance.
   */
  const unavailableLinkedIds = useMemo(() => {
    const linkable = new Set(linkableAccounts.map(account => account.id));
    return formData.linkedAccountIds.filter(id => !linkable.has(id));
  }, [formData.linkedAccountIds, linkableAccounts]);

  const hasLinkedAccounts = formData.linkedAccountIds.length > 0;

  const toggleLinkedAccount = (accountId: string): void => {
    updateField('linkedAccountIds',
      formData.linkedAccountIds.includes(accountId)
        ? formData.linkedAccountIds.filter(id => id !== accountId)
        : [...formData.linkedAccountIds, accountId]
    );
  };

  const removeLinkedAccount = (accountId: string): void => {
    updateField('linkedAccountIds', formData.linkedAccountIds.filter(id => id !== accountId));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={goal ? "Edit Goal" : "Create New Goal"} size="md">
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          <div>
            <label htmlFor={`${fieldId}-name`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Goal Name
            </label>
            <input
              id={`${fieldId}-name`}
              type="text"
              required
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className={inputClasses}
              placeholder="e.g., Emergency Fund"
            />
          </div>

          <div>
            <label htmlFor={`${fieldId}-type`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Goal Type
            </label>
            <select
              id={`${fieldId}-type`}
              value={formData.type}
              onChange={(e) => updateField('type', e.target.value as Goal["type"])}
              className={inputClasses}
            >
              <option value="savings">Savings Goal</option>
              <option value="debt-payoff">Debt Payoff</option>
              <option value="investment">Investment Target</option>
              <option value="custom">Custom Goal</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${fieldId}-current`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current Amount (£)
              </label>
              <MoneyInput
                id={`${fieldId}-current`}
                required={!hasLinkedAccounts}
                disabled={hasLinkedAccounts}
                aria-describedby={hasLinkedAccounts ? `${fieldId}-current-note` : undefined}
                value={formData.currentAmount}
                onChange={(value) => updateField('currentAmount', value)}
                className={`${inputClasses} disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400`}
              />
              {hasLinkedAccounts && (
                <p id={`${fieldId}-current-note`} className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Tracked from the linked accounts below — their combined balance is this goal&apos;s progress.
                </p>
              )}
            </div>

            <div>
              <label htmlFor={`${fieldId}-target`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Amount (£)
              </label>
              <MoneyInput
                id={`${fieldId}-target`}
                required
                value={formData.targetAmount}
                onChange={(value) => updateField('targetAmount', value)}
                className={inputClasses}
              />
            </div>
          </div>

          <div>
            <label htmlFor={`${fieldId}-date`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Date
            </label>
            <input
              id={`${fieldId}-date`}
              type="date"
              required
              value={formData.targetDate}
              onChange={(e) => updateField('targetDate', e.target.value)}
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor={`${fieldId}-description`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              id={`${fieldId}-description`}
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              className={inputClasses}
              rows={3}
              placeholder="What is this goal for?"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Link to Accounts (Optional)
            </span>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {linkableAccounts.map((account) => (
                <label key={account.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.linkedAccountIds.includes(account.id)}
                    onChange={() => toggleLinkedAccount(account.id)}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {account.name} ({account.type})
                  </span>
                </label>
              ))}
              {linkableAccounts.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">No open accounts to link.</p>
              )}
            </div>

            {unavailableLinkedIds.length > 0 && (
              <div className="mt-2 space-y-2">
                {/* A link to an account that has been deleted or closed. The
                    goal keeps pointing at it until the user says otherwise —
                    dropping it silently would quietly change the goal's
                    progress with no explanation. */}
                {unavailableLinkedIds.map(accountId => (
                  <div
                    key={accountId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2"
                  >
                    <span className="text-sm text-amber-800 dark:text-amber-200">
                      Account unavailable — it has been closed or deleted
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLinkedAccount(accountId)}
                      className="text-sm font-medium text-amber-900 dark:text-amber-100 underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 rounded"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => updateField('isActive', e.target.checked)}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Active Goal
              </span>
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
          {errors?.submit && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{errors.submit}</p>
            </div>
          )}
          <div className="flex justify-end space-x-3 w-full">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#1a2332] text-white rounded-2xl hover:bg-[#2d3a4d] focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {goal ? "Update Goal" : "Create Goal"}
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}

/**
 * What the "Active goal" checkbox means for the stored status.
 *
 * Unticking it PAUSES the goal. Ticking it resumes an active goal — but a goal
 * that has already been achieved stays achieved: completion is a fact about
 * the past, not a switch.
 */
function goalStatusFor(isActive: boolean, currentStatus: Goal['status']): Goal['status'] {
  if (!isActive) return 'paused';
  return currentStatus === 'completed' ? 'completed' : 'active';
}
