import { memo, useEffect } from 'react';
import type { TransferFormData, TransferErrors } from './types';
import { useLogger } from '../services/ServiceProvider';

interface BasicDetailsFormProps {
  formData: TransferFormData;
  setFormData: React.Dispatch<React.SetStateAction<TransferFormData>>;
  errors: TransferErrors;
}

export const BasicDetailsForm = memo(function BasicDetailsForm({ formData,
  setFormData,
  errors
 }: BasicDetailsFormProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BasicDetailsForm component initialized', {
      componentName: 'BasicDetailsForm'
    });
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Amount <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
          {errors.amount && (
            <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="e.g., Quarterly rebalancing, Investment funding, Tax payment"
          required
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Transfer Type
          </label>
          <select
            value={formData.transferType}
            onChange={(e) => setFormData({ ...formData, transferType: e.target.value as TransferFormData['transferType'] })}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="internal">Internal Transfer</option>
            <option value="wire">Wire Transfer</option>
            <option value="ach">ACH Transfer</option>
            <option value="crypto">Crypto Transfer</option>
            <option value="asset_sale">Asset Sale/Purchase</option>
            <option value="dividend">Dividend/Distribution</option>
            <option value="rebalance">Portfolio Rebalancing</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Purpose
          </label>
          <input
            type="text"
            value={formData.transferPurpose}
            onChange={(e) => setFormData({ ...formData, transferPurpose: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="e.g., Monthly investment allocation"
          />
        </div>
      </div>
    </>
  );
});