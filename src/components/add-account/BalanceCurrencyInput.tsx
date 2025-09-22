import React, { useEffect, memo } from 'react';
import { currencies } from './types';
import { useLogger } from '../services/ServiceProvider';

interface BalanceCurrencyInputProps {
  balance: string;
  currency: string;
  onBalanceChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  isDisabled: boolean;
}

export const BalanceCurrencyInput = memo(function BalanceCurrencyInput({ balance,
  currency,
  onBalanceChange,
  onCurrencyChange,
  isDisabled
 }: BalanceCurrencyInputProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BalanceCurrencyInput component initialized', {
      componentName: 'BalanceCurrencyInput'
    });
  }, []);

  const selectedCurrency = currencies.find(c => c.value === currency);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          Current Balance *
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">
            {selectedCurrency?.symbol}
          </span>
          <input
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => onBalanceChange(e.target.value)}
            className="w-full pl-8 pr-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200"
            placeholder="0.00"
            required
            disabled={isDisabled}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          Currency *
        </label>
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          disabled={isDisabled}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-3 focus:ring-primary/20 focus:border-primary dark:text-white transition-all duration-200 appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 0.5rem center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '1.5em 1.5em',
            paddingRight: '2.5rem'
          }}
        >
          {currencies.map(curr => (
            <option key={curr.value} value={curr.value}>
              {curr.symbol} {curr.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
});