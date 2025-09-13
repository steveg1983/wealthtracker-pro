import { memo, useEffect } from 'react';
import type { TransferFormData } from './types';
import { logger } from '../../services/loggingService';

interface AdvancedOptionsProps {
  formData: TransferFormData;
  setFormData: React.Dispatch<React.SetStateAction<TransferFormData>>;
  netAmount: number;
  convertedAmount: number;
}

export const AdvancedOptions = memo(function AdvancedOptions({
  formData,
  setFormData,
  netAmount,
  convertedAmount
}: AdvancedOptionsProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AdvancedOptions component initialized', {
      componentName: 'AdvancedOptions'
    });
  }, []);

  return (
    <div className="space-y-4 border-t pt-4">
      <h3 className="font-medium text-gray-900 dark:text-white">Fees & Exchange</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Transfer Fees
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.fees}
            onChange={(e) => setFormData(prev => ({ ...prev, fees: e.target.value }))}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="0.00"
          />
          {formData.fees && (
            <p className="text-xs text-gray-500 mt-1">
              Net amount: {netAmount.toLocaleString()}
            </p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Exchange Rate
          </label>
          <input
            type="number"
            step="0.000001"
            value={formData.exchangeRate}
            onChange={(e) => setFormData(prev => ({ ...prev, exchangeRate: e.target.value }))}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="1.0000"
          />
          {formData.exchangeRate && formData.exchangeRate !== '1' && (
            <p className="text-xs text-gray-500 mt-1">
              Converted: {convertedAmount.toLocaleString()}
            </p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Original Currency
          </label>
          <input
            type="text"
            value={formData.originalCurrency}
            onChange={(e) => setFormData(prev => ({ ...prev, originalCurrency: e.target.value }))}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="USD"
            maxLength={3}
          />
        </div>
      </div>
      
      <h3 className="font-medium text-gray-900 dark:text-white">Asset Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Asset Type
          </label>
          <select
            value={formData.assetType || 'cash'}
            onChange={(e) => setFormData(prev => ({ ...prev, assetType: e.target.value as NonNullable<TransferFormData['assetType']> }))}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="cash">Cash</option>
            <option value="stock">Stocks</option>
            <option value="bond">Bonds</option>
            <option value="crypto">Cryptocurrency</option>
            <option value="real_estate">Real Estate</option>
            <option value="commodity">Commodity</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Units/Shares
          </label>
          <input
            type="number"
            step="0.000001"
            value={formData.units}
            onChange={(e) => setFormData(prev => ({ ...prev, units: e.target.value }))}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="0"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Price per Unit
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.pricePerUnit}
            onChange={(e) => setFormData(prev => ({ ...prev, pricePerUnit: e.target.value }))}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="0.00"
          />
        </div>
      </div>
      
      <h3 className="font-medium text-gray-900 dark:text-white">Settlement & Reference</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Settlement Date
          </label>
          <input
            type="date"
            value={formData.settlementDate}
            onChange={(e) => setFormData(prev => ({ ...prev, settlementDate: e.target.value }))}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Reference Number
          </label>
          <input
            type="text"
            value={formData.reference}
            onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Wire ref, transaction ID, etc."
          />
        </div>
      </div>
      
      <h3 className="font-medium text-gray-900 dark:text-white">Notes & Tax</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            rows={2}
            placeholder="Additional notes about this transfer..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tax Implications
          </label>
          <textarea
            value={formData.taxImplications}
            onChange={(e) => setFormData(prev => ({ ...prev, taxImplications: e.target.value }))}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            rows={2}
            placeholder="Capital gains, tax deductions, etc."
          />
        </div>
      </div>
    </div>
  );
});
