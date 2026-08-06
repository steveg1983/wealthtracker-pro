import React, { useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import MoneyInput from './common/MoneyInput';
import DatePicker from './common/DatePicker';
import type { Category } from '../types';
import { parseMoneyInput } from '../utils/decimal';
import { formatDateForInput } from '../utils/dateFormatter';

// Types shared with ZeroBasedBudgeting
export interface ZeroBudgetItem {
  id: string;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  frequency: 'once' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  priority: 'essential' | 'important' | 'nice-to-have';
  startDate?: Date;
  endDate?: Date;
  notes?: string;
  isRecurring: boolean;
  isApproved: boolean;
}

export interface ZeroBudgetPeriod {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  totalIncome: number;
  items: ZeroBudgetItem[];
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
}

// New Period Modal
interface NewPeriodModalProps {
  onSave: (data: Partial<ZeroBudgetPeriod>) => void;
  onClose: () => void;
}

export function NewPeriodModal({ onSave, onClose }: NewPeriodModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    startDate: new Date(),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    totalIncome: 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen onClose={onClose} title="New Budget Period">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Period Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                placeholder="e.g., January 2024 Budget"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* dd/mm/yyyy everywhere — a native date input renders in the
                  browser's locale, not the app's. These two hold real Dates
                  and are required, so an emptied value (the picker's Clear)
                  is ignored rather than stored as an Invalid Date. */}
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <DatePicker
                  value={formatDateForInput(formData.startDate)}
                  onChange={(val) => { if (val) setFormData({ ...formData, startDate: new Date(val) }); }}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                  aria-label="Budget start date"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <DatePicker
                  value={formatDateForInput(formData.endDate)}
                  onChange={(val) => { if (val) setFormData({ ...formData, endDate: new Date(val) }); }}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                  aria-label="Budget end date"
                />
              </div>
            </div>

            <div>
              <label htmlFor="zero-based-total-income" className="block text-sm font-medium mb-1">Total Expected Income</label>
              <MoneyInput
                id="zero-based-total-income"
                value={formData.totalIncome}
                onChange={(value) => setFormData({ ...formData, totalIncome: parseMoneyInput(value) ?? 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              />
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d]"
          >
            Create Period
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// Budget Item Modal
interface BudgetItemModalProps {
  item: ZeroBudgetItem | null;
  categories: Category[];
  onSave: (item: ZeroBudgetItem) => void;
  onClose: () => void;
}

export function BudgetItemModal({ item, categories, onSave, onClose }: BudgetItemModalProps) {
  const [formData, setFormData] = useState<Partial<ZeroBudgetItem>>(
    item || {
      category: '',
      description: '',
      amount: 0,
      frequency: 'monthly',
      priority: 'important',
      isRecurring: false,
      isApproved: false,
      notes: ''
    }
  );

  const expenseCategories = categories.filter(c => c.type === 'expense' || c.type === 'both');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as ZeroBudgetItem);
  };

  return (
    <Modal isOpen onClose={onClose} title={item ? 'Edit Budget Item' : 'Add Budget Item'}>
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                placeholder="e.g., Monthly rent payment"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                >
                  <option value="">Select category</option>
                  {expenseCategories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="zero-based-item-amount" className="block text-sm font-medium mb-1">Amount</label>
                <MoneyInput
                  id="zero-based-item-amount"
                  value={formData.amount}
                  onChange={(value) => setFormData({ ...formData, amount: parseMoneyInput(value) ?? 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Frequency</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as ZeroBudgetItem['frequency'] })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="once">One-time</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as ZeroBudgetItem['priority'] })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="essential">Essential</option>
                  <option value="important">Important</option>
                  <option value="nice-to-have">Nice to Have</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                rows={2}
                placeholder="Additional notes or justification"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Recurring expense</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isApproved}
                  onChange={(e) => setFormData({ ...formData, isApproved: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Pre-approved</span>
              </label>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d]"
          >
            {item ? 'Update' : 'Add'} Item
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
