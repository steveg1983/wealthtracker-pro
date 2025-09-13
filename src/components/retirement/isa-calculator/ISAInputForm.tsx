import React, { useEffect, memo } from 'react';
import type { ISAFormData } from './types';
import { logger } from '../../../services/loggingService';

interface ISAInputFormProps {
  formData: ISAFormData;
  onUpdate: (updates: Partial<ISAFormData>) => void;
  canOpenLifetimeISA: () => boolean;
  isOverLimit: () => boolean;
  ISA_ANNUAL_LIMIT: number;
  LIFETIME_ISA_LIMIT: number;
}

export const ISAInputForm = memo(function ISAInputForm({
  formData,
  onUpdate,
  canOpenLifetimeISA,
  isOverLimit,
  ISA_ANNUAL_LIMIT,
  LIFETIME_ISA_LIMIT
}: ISAInputFormProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ISAInputForm component initialized', {
      componentName: 'ISAInputForm'
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current Age
          </label>
          <input
            type="number"
            value={formData.currentAge}
            onChange={(e) => onUpdate({ currentAge: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="18"
            max="100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Target Age
          </label>
          <input
            type="number"
            value={formData.retirementAge}
            onChange={(e) => onUpdate({ retirementAge: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="40"
            max="100"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Cash ISA Allocation
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
          <input
            type="number"
            value={formData.cashISAAmount}
            onChange={(e) => onUpdate({ cashISAAmount: Number(e.target.value) })}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            max={ISA_ANNUAL_LIMIT}
            step="100"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Stocks & Shares ISA Allocation
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
          <input
            type="number"
            value={formData.stocksISAAmount}
            onChange={(e) => onUpdate({ stocksISAAmount: Number(e.target.value) })}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            max={ISA_ANNUAL_LIMIT}
            step="100"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Lifetime ISA Allocation {!canOpenLifetimeISA() && '(Age restricted)'}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
          <input
            type="number"
            value={formData.lifetimeISAAmount}
            onChange={(e) => onUpdate({ 
              lifetimeISAAmount: Math.min(Number(e.target.value), LIFETIME_ISA_LIMIT) 
            })}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            max={LIFETIME_ISA_LIMIT}
            step="100"
            disabled={!canOpenLifetimeISA()}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Max £4,000/year, 25% bonus
        </p>
      </div>

      {isOverLimit() && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">
            Total exceeds £20,000 annual ISA allowance. Amounts will be adjusted.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Cash ISA Interest (%)
          </label>
          <input
            type="number"
            value={formData.cashInterestRate}
            onChange={(e) => onUpdate({ cashInterestRate: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            max="10"
            step="0.1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Stocks Return (%)
          </label>
          <input
            type="number"
            value={formData.stocksExpectedReturn}
            onChange={(e) => onUpdate({ stocksExpectedReturn: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            min="0"
            max="15"
            step="0.5"
          />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.buyingFirstHome}
            onChange={(e) => onUpdate({ buyingFirstHome: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Planning to buy first home
          </span>
        </label>
        
        {formData.buyingFirstHome && (
          <div className="mt-3 ml-6 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Years until purchase
              </label>
              <input
                type="number"
                value={formData.homePurchaseYear}
                onChange={(e) => onUpdate({ homePurchaseYear: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="1"
                max="10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expected home price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <input
                  type="number"
                  value={formData.homePrice}
                  onChange={(e) => onUpdate({ homePrice: Number(e.target.value) })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="50000"
                  max="1000000"
                  step="10000"
                />
              </div>
              {formData.homePrice > 450000 && (
                <p className="text-xs text-red-500 mt-1">
                  Lifetime ISA can only be used for homes up to £450,000
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});