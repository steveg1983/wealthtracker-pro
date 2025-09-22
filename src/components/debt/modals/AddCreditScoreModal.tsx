import React, { useEffect, useState, useCallback } from 'react';
import type { CreditScoreEntry } from '../../DebtManagement';
import { useLogger } from '../services/ServiceProvider';

interface AddCreditScoreModalProps {
  onAdd: (score: CreditScoreEntry) => void;
  onClose: () => void;
}

export function AddCreditScoreModal({ onAdd, onClose  }: AddCreditScoreModalProps): React.JSX.Element {
  const logger = useLogger();
  const [formData, setFormData] = useState({
    score: '',
    date: new Date().toISOString().split('T')[0],
    provider: 'fico' as CreditScoreEntry['provider'],
    notes: ''
  });

  const handleSubmit = useCallback(() => {
    if (!formData.score || !formData.date) return;
    
    const score: CreditScoreEntry = {
      id: Date.now().toString(),
      score: parseInt(formData.score),
      date: new Date(formData.date),
      provider: formData.provider,
      notes: formData.notes
    };
    
    onAdd(score);
    onClose();
  }, [formData, onAdd, onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Credit Score</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Credit Score
            </label>
            <input
              type="number"
              value={formData.score}
              onChange={(e) => setFormData({...formData, score: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="750"
              min="300"
              max="850"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Provider
            </label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData({...formData, provider: e.target.value as CreditScoreEntry['provider']})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="fico">FICO</option>
              <option value="vantage">VantageScore</option>
              <option value="experian">Experian</option>
              <option value="equifax">Equifax</option>
              <option value="transunion">TransUnion</option>
              <option value="other">Other</option>
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
              placeholder="Any notes about this score..."
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
            Add Score
          </button>
        </div>
      </div>
    </div>
  );
}