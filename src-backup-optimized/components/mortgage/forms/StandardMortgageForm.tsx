import React, { useEffect, memo } from 'react';
import { RadioCheckbox } from '../../common/RadioCheckbox';
import AccountSelector from '../../AccountSelector';
import { useLogger } from '../services/ServiceProvider';

interface StandardMortgageFormProps {
  formData: {
    propertyPrice: number;
    deposit: number;
    interestRate: number;
    termYears: number;
    region: 'england' | 'scotland' | 'wales';
    firstTimeBuyer: boolean;
    additionalProperty: boolean;
    mortgageType: 'fixed' | 'variable' | 'tracker';
    useTwoTierRate: boolean;
    initialRatePeriod: 2 | 3 | 5 | 10;
    initialRate: number;
    subsequentRate: number;
    useHelpToBuy: boolean;
    isLondon: boolean;
  };
  onFormChange: (updates: Partial<StandardMortgageFormProps['formData']>) => void;
  useRealAccountData: boolean;
  setUseRealAccountData: (value: boolean) => void;
  selectedAccountIds: string[];
  onAccountSelection: (selectedIds: string[]) => void;
  financialData?: any;
  formatCurrency: (value: number) => string;
}

export const StandardMortgageForm = memo(function StandardMortgageForm({ formData,
  onFormChange,
  useRealAccountData,
  setUseRealAccountData,
  selectedAccountIds,
  onAccountSelection,
  financialData,
  formatCurrency
 }: StandardMortgageFormProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('StandardMortgageForm component initialized', {
      componentName: 'StandardMortgageForm'
    });
  }, []);

  
  return (
    <div className="space-y-4">
      {/* Mortgage Options */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Mortgage Options
        </h4>
        
        <label className="flex items-center">
          <input
            type="radio"
            name="mortgageStructure"
            checked={!formData.useTwoTierRate}
            onChange={() => onFormChange({ useTwoTierRate: false })}
            className="mr-3 text-slate-500 focus:ring-slate-400 accent-slate-500 flex-shrink-0"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Single Rate Mortgage
          </span>
        </label>
        
        <label className="flex items-center">
          <input
            type="radio"
            name="mortgageStructure"
            checked={formData.useTwoTierRate}
            onChange={() => onFormChange({ useTwoTierRate: true })}
            className="mr-3 text-slate-500 focus:ring-slate-400 accent-slate-500 flex-shrink-0"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Two-tier Rate (Fixed then Variable)
          </span>
        </label>
      </div>

      {/* Property Details */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Property Price
        </label>
        <input
          type="number"
          value={formData.propertyPrice}
          onChange={(e) => onFormChange({ propertyPrice: parseFloat(e.target.value) || 0 })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="350000"
        />
      </div>

      {/* Deposit Section */}
      <div>
        {useRealAccountData && financialData && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Using Real Account Data
              </span>
              <button
                onClick={() => setUseRealAccountData(false)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Use manual input
              </button>
            </div>
            <AccountSelector
              onSelectionChange={onAccountSelection}
              selectedAccountIds={selectedAccountIds}
              multiSelect={true}
              showBalances={true}
            />
            <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
              Total Selected: {formatCurrency(formData.deposit)}
            </div>
          </div>
        )}
        
        {!useRealAccountData && (
          <>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Deposit Amount
              {financialData && (
                <button
                  onClick={() => setUseRealAccountData(true)}
                  className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Use account balances
                </button>
              )}
            </label>
            <input
              type="number"
              value={formData.deposit}
              onChange={(e) => onFormChange({ deposit: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="70000"
            />
          </>
        )}
        
        {formData.propertyPrice > 0 && formData.deposit > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Loan to Value: {((1 - formData.deposit / formData.propertyPrice) * 100).toFixed(1)}%
          </p>
        )}
      </div>

      {/* Interest Rate Section */}
      {!formData.useTwoTierRate ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Interest Rate (%)
          </label>
          <input
            type="number"
            value={formData.interestRate}
            onChange={(e) => onFormChange({ interestRate: parseFloat(e.target.value) || 0 })}
            step="0.01"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="4.5"
          />
        </div>
      ) : (
        <div className="space-y-4 p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Initial Fixed Period
            </label>
            <select
              value={formData.initialRatePeriod}
              onChange={(e) => onFormChange({ initialRatePeriod: parseInt(e.target.value) as any })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={2}>2 years</option>
              <option value={3}>3 years</option>
              <option value={5}>5 years</option>
              <option value={10}>10 years</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Initial Fixed Rate (%)
            </label>
            <input
              type="number"
              value={formData.initialRate}
              onChange={(e) => onFormChange({ initialRate: parseFloat(e.target.value) || 0 })}
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="3.5"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subsequent Variable Rate (%)
            </label>
            <input
              type="number"
              value={formData.subsequentRate}
              onChange={(e) => onFormChange({ subsequentRate: parseFloat(e.target.value) || 0 })}
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="5.5"
            />
          </div>
        </div>
      )}

      {/* Term */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Mortgage Term (years)
        </label>
        <input
          type="number"
          value={formData.termYears}
          onChange={(e) => onFormChange({ termYears: parseInt(e.target.value) || 0 })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="25"
        />
      </div>

      {/* Additional Options */}
      <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Additional Information
        </h4>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Region
          </label>
          <select
            value={formData.region}
            onChange={(e) => onFormChange({ region: e.target.value as any })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="england">England</option>
            <option value="scotland">Scotland</option>
            <option value="wales">Wales</option>
          </select>
        </div>

        <label className="flex items-center">
          <RadioCheckbox
            checked={formData.firstTimeBuyer}
            onChange={(checked) => onFormChange({ firstTimeBuyer: checked })}
            className="mr-3"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            First-time buyer
          </span>
        </label>

        <label className="flex items-center">
          <RadioCheckbox
            checked={formData.additionalProperty}
            onChange={(checked) => onFormChange({ additionalProperty: checked })}
            className="mr-3"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Additional property
          </span>
        </label>
      </div>
    </div>
  );
});