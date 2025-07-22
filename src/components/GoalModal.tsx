import { useEffect } from "react";
import { useApp } from "../contexts/AppContext";
import type { Goal } from "../types";
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useModalForm } from '../hooks/useModalForm';

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

export default function GoalModal({ isOpen, onClose, goal }: GoalModalProps): React.JSX.Element {
  const { addGoal, updateGoal, accounts } = useApp();
  
  const { formData, updateField, handleSubmit, setFormData } = useModalForm<FormData>(
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
      onSubmit: (data) => {
        const goalData = {
          name: data.name,
          type: data.type,
          targetAmount: parseFloat(data.targetAmount) || 0,
          currentAmount: parseFloat(data.currentAmount) || 0,
          targetDate: new Date(data.targetDate),
          description: data.description || undefined,
          linkedAccountIds: data.linkedAccountIds.length > 0 ? data.linkedAccountIds : undefined,
          isActive: data.isActive,
          createdAt: goal?.createdAt || new Date(),
        };

        if (goal) {
          updateGoal(goal.id, goalData);
        } else {
          addGoal(goalData);
        }
      },
      onClose
    }
  );

  useEffect(() => {
    if (goal) {
      setFormData({
        name: goal.name,
        type: goal.type,
        targetAmount: goal.targetAmount.toString(),
        currentAmount: goal.currentAmount.toString(),
        targetDate: goal.targetDate.toISOString().split("T")[0],
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


  const toggleLinkedAccount = (accountId: string): void => {
    updateField('linkedAccountIds', 
      formData.linkedAccountIds.includes(accountId)
        ? formData.linkedAccountIds.filter(id => id !== accountId)
        : [...formData.linkedAccountIds, accountId]
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={goal ? "Edit Goal" : "Create New Goal"} size="md">
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Goal Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              placeholder="e.g., Emergency Fund"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Goal Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => updateField('type', e.target.value as Goal["type"])}
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            >
              <option value="savings">Savings Goal</option>
              <option value="debt-payoff">Debt Payoff</option>
              <option value="investment">Investment Target</option>
              <option value="custom">Custom Goal</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current Amount (£)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.currentAmount}
                onChange={(e) => updateField('currentAmount', e.target.value)}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Amount (£)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.targetAmount}
                onChange={(e) => updateField('targetAmount', e.target.value)}
                className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Date
            </label>
            <input
              type="date"
              required
              value={formData.targetDate}
              onChange={(e) => updateField('targetDate', e.target.value)}
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="w-full px-3 py-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
              rows={3}
              placeholder="What is this goal for?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Link to Accounts (Optional)
            </label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {accounts.map((account) => (
                <label key={account.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.linkedAccountIds.includes(account.id)}
                    onChange={() => toggleLinkedAccount(account.id)}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {account.name} ({account.type})
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => updateField('isActive', e.target.checked)}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Active Goal
              </span>
            </label>
          </div>
        </ModalBody>
        <ModalFooter>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {goal ? "Update Goal" : "Create Goal"}
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}