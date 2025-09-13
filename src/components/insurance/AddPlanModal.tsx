import React, { useEffect, memo } from 'react';
import { RadioCheckbox } from '../common/RadioCheckbox';
import type { InsurancePlan } from './types';
import { logger } from '../../services/loggingService';

interface AddPlanModalProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: InsurancePlan;
  saving: boolean;
  onFormChange: (data: InsurancePlan) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const AddPlanModal = memo(function AddPlanModal({
  isOpen,
  isEditing,
  formData,
  saving,
  onFormChange,
  onSave,
  onCancel
}: AddPlanModalProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('AddPlanModal component initialized', {
      componentName: 'AddPlanModal'
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">
          {isEditing ? 'Edit Insurance Plan' : 'Add Insurance Plan'}
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Insurance Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => onFormChange({ ...formData, type: e.target.value as InsurancePlan['type'] })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
              >
                <option value="life">Life Insurance</option>
                <option value="disability">Disability Insurance</option>
                <option value="health">Health Insurance</option>
                <option value="property">Property Insurance</option>
                <option value="auto">Auto Insurance</option>
                <option value="umbrella">Umbrella Insurance</option>
                <option value="long-term-care">Long-Term Care</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider
              </label>
              <input
                type="text"
                value={formData.provider}
                onChange={(e) => onFormChange({ ...formData, provider: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                placeholder="Insurance company name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Policy Number (Optional)
              </label>
              <input
                type="text"
                value={formData.policyNumber || ''}
                onChange={(e) => onFormChange({ ...formData, policyNumber: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                placeholder="Policy #"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coverage Amount
              </label>
              <input
                type="number"
                value={formData.coverageAmount}
                onChange={(e) => onFormChange({ ...formData, coverageAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Premium
              </label>
              <input
                type="number"
                value={formData.monthlyPremium}
                onChange={(e) => onFormChange({ ...formData, monthlyPremium: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                placeholder="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Annual Premium
              </label>
              <input
                type="number"
                value={formData.annualPremium}
                onChange={(e) => onFormChange({ ...formData, annualPremium: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                placeholder="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deductible
              </label>
              <input
                type="number"
                value={formData.deductible}
                onChange={(e) => onFormChange({ ...formData, deductible: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => onFormChange({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Renewal Date
              </label>
              <input
                type="date"
                value={formData.renewalDate}
                onChange={(e) => onFormChange({ ...formData, renewalDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => onFormChange({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500"
              rows={3}
              placeholder="Additional information about this policy..."
            />
          </div>

          <div className="flex items-center">
            <RadioCheckbox
              id="isActive"
              checked={formData.isActive}
              onChange={(checked) => onFormChange({ ...formData, isActive: checked })}
              className="mr-2"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Active Policy
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !formData.provider || formData.coverageAmount <= 0}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEditing ? 'Update Plan' : 'Add Plan'}
          </button>
        </div>
      </div>
    </div>
  );
});
