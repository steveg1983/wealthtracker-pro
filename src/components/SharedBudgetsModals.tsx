import React from 'react';
import type { Category } from '../types';

type BudgetPeriod = 'monthly' | 'weekly' | 'yearly';

interface BudgetFormState {
  name: string;
  categoryId: string;
  amount: string;
  period: BudgetPeriod;
  approvalRequired: boolean;
  approvalThreshold: string;
}

interface GoalFormState {
  name: string;
  targetAmount: string;
  targetDate: string;
  categoryId: string;
  description: string;
  isHouseholdGoal: boolean;
}

interface CreateBudgetModalProps {
  form: BudgetFormState;
  setForm: (form: BudgetFormState) => void;
  categories: Category[];
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function CreateBudgetModal({ form, setForm, categories, onSubmit, onClose }: CreateBudgetModalProps): React.JSX.Element {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Create Shared Budget</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Budget Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              required
            >
              <option value="">Select category</option>
              {categories.filter(c => c.type === 'expense' || c.type === 'both').map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period</label>
              <select
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value as BudgetPeriod })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="approvalRequired"
              checked={form.approvalRequired}
              onChange={(e) => setForm({ ...form, approvalRequired: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="approvalRequired" className="text-sm text-gray-700 dark:text-gray-300">
              Require approval for expenses over threshold
            </label>
          </div>
          {form.approvalRequired && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Approval Threshold</label>
              <input
                type="number"
                step="0.01"
                value={form.approvalThreshold}
                onChange={(e) => setForm({ ...form, approvalThreshold: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d]">Create Budget</button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CreateGoalModalProps {
  form: GoalFormState;
  setForm: (form: GoalFormState) => void;
  categories: Category[];
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function CreateGoalModal({ form, setForm, categories, onSubmit, onClose }: CreateGoalModalProps): React.JSX.Element {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Create Shared Goal</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Goal Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Amount</label>
              <input
                type="number"
                step="0.01"
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Date</label>
              <input
                type="date"
                value={form.targetDate}
                onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              <option value="">No category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isHouseholdGoal"
              checked={form.isHouseholdGoal}
              onChange={(e) => setForm({ ...form, isHouseholdGoal: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="isHouseholdGoal" className="text-sm text-gray-700 dark:text-gray-300">
              Shared household goal (visible to all members)
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d]">Create Goal</button>
          </div>
        </form>
      </div>
    </div>
  );
}
