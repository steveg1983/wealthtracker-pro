import React, { useEffect, memo, RefObject } from 'react';
import { BanknoteIcon } from '../icons';
import { getCurrencySymbol } from '../../utils/currency';
import { logger } from '../../services/loggingService';

interface AmountInputProps {
  amount: string;
  formattedAmount: string;
  accountId: string;
  accounts: Array<{ id: string; currency: string }>;
  inputRef: RefObject<HTMLInputElement>;
  onChange: (value: string) => void;
  onBlur: () => void;
  onFocus: () => void;
}

export const AmountInput = memo(function AmountInput({
  amount,
  formattedAmount,
  accountId,
  accounts,
  inputRef,
  onChange,
  onBlur,
  onFocus
}: AmountInputProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AmountInput component initialized', {
      componentName: 'AmountInput'
    });
  }, []);

  const selectedAccount = accounts.find(a => a.id === accountId);
  const currencySymbol = selectedAccount ? getCurrencySymbol(selectedAccount.currency) : '';
  
  return (
    <div className="md:col-span-5">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        <BanknoteIcon size={16} />
        Amount {currencySymbol && `(${currencySymbol})`}
      </label>
      <input
        ref={inputRef}
        type="text"
        value={formattedAmount}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder="0.00"
        className={`w-full px-3 py-2 h-[42px] text-right bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
          amount && parseFloat(amount) < 0
            ? 'text-red-600 dark:text-red-400'
            : amount && parseFloat(amount) > 0
            ? 'text-green-600 dark:text-green-400'
            : 'text-gray-900 dark:text-white'
        }`}
        required
      />
    </div>
  );
});