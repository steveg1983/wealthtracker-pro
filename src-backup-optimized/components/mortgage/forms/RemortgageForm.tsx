import React, { useEffect, memo } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface RemortgageFormProps {
  formData: {
    propertyPrice: number;
    currentBalance: number;
    currentRate: number;
    currentRemainingYears: number;
    newRate: number;
    termYears: number;
    arrangementFee: number;
  };
  onFormChange: (updates: Partial<RemortgageFormProps['formData']>) => void;
  formatCurrency: (value: number) => string;
}

export const RemortgageForm = memo(function RemortgageForm({ formData,
  onFormChange,
  formatCurrency
 }: RemortgageFormProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('RemortgageForm component initialized', {
      componentName: 'RemortgageForm'
    });
  }, []);

  
  const equity = formData.propertyPrice - formData.currentBalance;
  const ltv = formData.propertyPrice > 0 ? (formData.currentBalance / formData.propertyPrice) * 100 : 0;
  
  return (
    <div className="space-y-4">
      <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg">
        <h4 className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-3">
          Current Mortgage Details
        </h4>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Property Value
            </label>
            <input
              type="number"
              value={formData.propertyPrice}
              onChange={(e) => onFormChange({ propertyPrice: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="450000"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Outstanding Balance
            </label>
            <input
              type="number"
              value={formData.currentBalance}
              onChange={(e) => onFormChange({ currentBalance: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="250000"
            />
          </div>
          
          {formData.propertyPrice > 0 && formData.currentBalance > 0 && (
            <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-orange-700 dark:text-orange-300">Equity:</span>
                <span className="font-semibold text-orange-900 dark:text-orange-100">
                  {formatCurrency(equity)}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-orange-700 dark:text-orange-300">Current LTV:</span>
                <span className="font-semibold text-orange-900 dark:text-orange-100">
                  {ltv.toFixed(1)}%
                </span>
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Interest Rate (%)
            </label>
            <input
              type="number"
              value={formData.currentRate}
              onChange={(e) => onFormChange({ currentRate: parseFloat(e.target.value) || 0 })}
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="5.5"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Years Remaining on Current Mortgage
            </label>
            <input
              type="number"
              value={formData.currentRemainingYears}
              onChange={(e) => onFormChange({ currentRemainingYears: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="20"
            />
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg">
        <h4 className="text-sm font-medium text-green-700 dark:text-green-300 mb-3">
          New Mortgage Details
        </h4>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Interest Rate (%)
            </label>
            <input
              type="number"
              value={formData.newRate}
              onChange={(e) => onFormChange({ newRate: parseFloat(e.target.value) || 0 })}
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="3.5"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Mortgage Term (years)
            </label>
            <input
              type="number"
              value={formData.termYears}
              onChange={(e) => onFormChange({ termYears: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="25"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Arrangement/Product Fee
            </label>
            <input
              type="number"
              value={formData.arrangementFee}
              onChange={(e) => onFormChange({ arrangementFee: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="999"
            />
          </div>
        </div>
      </div>
    </div>
  );
});