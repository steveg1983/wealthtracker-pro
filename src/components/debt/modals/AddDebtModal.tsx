import React, { useEffect, useState, useCallback } from 'react';
import { PlusIcon } from '../../icons';
import type { Account } from '../../../types';
import type { Debt } from '../../DebtManagement';
import { toDecimal } from '../../../utils/decimal';
import { logger } from '../../../services/loggingService';

interface AddDebtModalProps {
  accounts: Account[];
  onAdd: (debt: Debt) => void;
  onClose: () => void;
}

export function AddDebtModal({ accounts, onAdd, onClose }: AddDebtModalProps): React.JSX.Element {
  const [formData, setFormData] = useState({
    name: '',
    type: 'credit_card' as Debt['type'],
    balance: '',
    interestRate: '',
    minimumPayment: '',
    dueDate: 1,
    accountId: '',
    notes: ''
  });

  const handleSubmit = useCallback(() => {
    if (!formData.name || !formData.balance || !formData.interestRate || !formData.minimumPayment || !formData.accountId) return;
    
    const debt: Debt = {
      id: Date.now().toString(),
      name: formData.name,
      type: formData.type,
      balance: toDecimal(parseFloat(formData.balance)),
      interestRate: toDecimal(parseFloat(formData.interestRate)),
      minimumPayment: toDecimal(parseFloat(formData.minimumPayment)),
      dueDate: formData.dueDate,
      accountId: formData.accountId,
      isActive: true,
      notes: formData.notes,
      createdAt: new Date(),
      paymentHistory: []
    };
    
    onAdd(debt);
    onClose();
  }, [formData, onAdd, onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Debt</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Debt Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., Credit Card"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Debt Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value as Debt['type']})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="credit_card">Credit Card</option>
              <option value="personal_loan">Personal Loan</option>
              <option value="mortgage">Mortgage</option>
              <option value="student_loan">Student Loan</option>
              <option value="auto_loan">Auto Loan</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Balance
              </label>
              <input
                type="number"
                value={formData.balance}
                onChange={(e) => setFormData({...formData, balance: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="10000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Interest Rate (%)
              </label>
              <input
                type="number"
                value={formData.interestRate}
                onChange={(e) => setFormData({...formData, interestRate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="18.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minimum Payment
              </label>
              <input
                type="number"
                value={formData.minimumPayment}
                onChange={(e) => setFormData({...formData, minimumPayment: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Due Date (Day of Month)
              </label>
              <input
                type="number"
                value={formData.dueDate}
                onChange={(e) => setFormData({...formData, dueDate: parseInt(e.target.value) || 1})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="1"
                max="31"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Account
            </label>
            <select
              value={formData.accountId}
              onChange={(e) => setFormData({...formData, accountId: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select account...</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={2}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            Add Debt
          </button>
        </div>
      </div>
    </div>
  );
}