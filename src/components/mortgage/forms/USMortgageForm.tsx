import React, { useEffect, memo, useMemo } from 'react';
import AccountSelector from '../../AccountSelector';
import { usMortgageFormService } from '../../../services/usMortgageFormService';
import { CreditScoreIndicator } from '../components/CreditScoreIndicator';
import { LoanTypeInfo } from '../components/LoanTypeInfo';
import { logger } from '../../../services/loggingService';

interface USMortgageFormProps {
  formData: {
    homePrice: number;
    downPayment: number;
    interestRate: number;
    termYears: number;
    state: string;
    loanType: 'conventional' | 'fha' | 'va' | 'usda' | 'jumbo';
    creditScore: number;
  };
  onFormChange: (updates: Partial<USMortgageFormProps['formData']>) => void;
  useRealAccountData: boolean;
  setUseRealAccountData: (value: boolean) => void;
  selectedAccountIds: string[];
  onAccountSelection: (selectedIds: string[]) => void;
}

export const USMortgageForm = memo(function USMortgageForm({
  formData,
  onFormChange,
  useRealAccountData,
  setUseRealAccountData,
  selectedAccountIds,
  onAccountSelection
}: USMortgageFormProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('USMortgageForm component initialized', {
      componentName: 'USMortgageForm'
    });
  }, []);

  // Get US states from service
  const usStates = useMemo(() => usMortgageFormService.getUSStates(), []);
  
  // Calculate down payment percentage
  const downPaymentPercent = useMemo(() => 
    usMortgageFormService.calculateDownPaymentPercentage(formData.downPayment, formData.homePrice),
    [formData.downPayment, formData.homePrice]
  );

  return (
    <div className="space-y-4">
      {/* Property and Down Payment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Home Price
          </label>
          <input
            type="number"
            value={formData.homePrice}
            onChange={(e) => onFormChange({ homePrice: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            step="5000"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Down Payment
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={formData.downPayment}
              onChange={(e) => onFormChange({ downPayment: Number(e.target.value) })}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min="0"
              step="1000"
            />
            <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {downPaymentPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interest Rate and Term */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Interest Rate (%)
          </label>
          <input
            type="number"
            value={formData.interestRate}
            onChange={(e) => onFormChange({ interestRate: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            max="20"
            step="0.125"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Loan Term
          </label>
          <select
            value={formData.termYears}
            onChange={(e) => onFormChange({ termYears: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value={15}>15 years</option>
            <option value={30}>30 years</option>
          </select>
        </div>
      </div>

      {/* State and Loan Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            State
          </label>
          <select
            value={formData.state}
            onChange={(e) => onFormChange({ state: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {usStates.map(state => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Loan Type
          </label>
          <select
            value={formData.loanType}
            onChange={(e) => onFormChange({ loanType: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="conventional">Conventional</option>
            <option value="fha">FHA</option>
            <option value="va">VA</option>
            <option value="usda">USDA</option>
            <option value="jumbo">Jumbo</option>
          </select>
        </div>
      </div>

      {/* Credit Score */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Credit Score
        </label>
        <input
          type="number"
          value={formData.creditScore}
          onChange={(e) => onFormChange({ creditScore: Number(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          min="300"
          max="850"
        />
        <div className="mt-2">
          <CreditScoreIndicator score={formData.creditScore} />
        </div>
      </div>

      {/* Account Data Integration */}
      <div className="border-t pt-4">
        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={useRealAccountData}
            onChange={(e) => setUseRealAccountData(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Use data from my accounts
          </span>
        </label>
        
        {useRealAccountData && (
          <AccountSelector
            selectedAccountIds={selectedAccountIds}
            onSelectionChange={onAccountSelection}
            multiSelect={true}
            accountTypes={['savings', 'checking', 'investment']}
          />
        )}
      </div>

      {/* Loan Type Information */}
      <LoanTypeInfo 
        loanType={formData.loanType} 
        downPaymentPercent={downPaymentPercent} 
      />
    </div>
  );
});