import React, { useEffect, memo } from 'react';
import { 
  WalletIcon as Wallet,
  CreditCardIcon as CreditCard,
  TrendingUpIcon as TrendingUp,
  PiggyBankIcon as PiggyBank,
  BanknoteIcon as Banknote,
  PackageIcon as Package,
} from '../icons';
import type { AccountFormData } from './types';
import { useLogger } from '../services/ServiceProvider';

const accountTypes = [
  { value: 'current', label: 'Current Account', icon: Wallet, description: 'Everyday spending account' },
  { value: 'savings', label: 'Savings Account', icon: PiggyBank, description: 'Long-term savings' },
  { value: 'credit', label: 'Credit Card', icon: CreditCard, description: 'Credit line account' },
  { value: 'loan', label: 'Loan', icon: Banknote, description: 'Mortgages, personal loans' },
  { value: 'investment', label: 'Investment', icon: TrendingUp, description: 'Stocks, bonds, funds' },
  { value: 'assets', label: 'Other Assets', icon: Package, description: 'Property, valuables' },
];

interface AccountTypeSelectorProps {
  value: AccountFormData['type'];
  onChange: (type: AccountFormData['type']) => void;
  isDisabled: boolean;
}

export const AccountTypeSelector = memo(function AccountTypeSelector({ value,
  onChange,
  isDisabled
 }: AccountTypeSelectorProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('AccountTypeSelector component initialized', {
      componentName: 'AccountTypeSelector'
    });
  }, []);

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
        Account Type *
      </label>
      <div className="grid grid-cols-2 gap-3">
        {accountTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = value === type.value;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => onChange(type.value as AccountFormData['type'])}
              disabled={isDisabled}
              className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                isSelected
                  ? 'border-primary bg-primary/10 dark:bg-primary/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-start gap-3">
                <Icon 
                  size={20} 
                  className={isSelected ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}
                />
                <div className="text-left flex-1">
                  <div className={`text-sm font-medium ${
                    isSelected ? 'text-primary' : 'text-gray-700 dark:text-gray-200'
                  }`}>
                    {type.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {type.description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

export function getSelectedType(value: AccountFormData['type']) {
  return accountTypes.find(t => t.value === value);
}