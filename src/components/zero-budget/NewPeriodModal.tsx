import React, { useEffect, useState, memo } from 'react';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import type { ZeroBudgetPeriod } from './types';
import { logger } from '../../services/loggingService';

interface NewPeriodModalProps {
  onSave: (data: Partial<ZeroBudgetPeriod>) => void;
  onClose: () => void;
}

export const NewPeriodModal = memo(function NewPeriodModal({ onSave, onClose }: NewPeriodModalProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('NewPeriodModal component initialized', {
      componentName: 'NewPeriodModal'
    });
  }, []);

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
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate.toISOString().split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, startDate: new Date(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={formData.endDate.toISOString().split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, endDate: new Date(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Total Expected Income</label>
              <input
                type="number"
                step="0.01"
                value={formData.totalIncome}
                onChange={(e) => setFormData({ ...formData, totalIncome: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                placeholder="0.00"
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
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Create Period
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
});