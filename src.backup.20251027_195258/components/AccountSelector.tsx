import React, { useMemo, useState } from 'react';
import { useRealFinancialData } from '../hooks/useRealFinancialData';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { CheckIcon, ChevronDownIcon, WalletIcon } from './icons';
import type { Account } from '../types';

interface AccountSelectorProps {
  selectedAccountIds: string[];
  onSelectionChange: (accountIds: string[], totalAmount: number) => void;
  label?: string;
  helpText?: string;
  maxSelection?: number;
  accountTypes?: ('checking' | 'savings' | 'current' | 'investment')[];
}

export default function AccountSelector({
  selectedAccountIds,
  onSelectionChange,
  label = 'Select accounts for down payment',
  helpText = 'Choose which accounts to use as your down payment source',
  maxSelection = 3,
  accountTypes = ['checking', 'savings', 'current']
}: AccountSelectorProps): React.JSX.Element {
  const financialData = useRealFinancialData();
  const { formatCurrency } = useCurrencyDecimal();
  const [isOpen, setIsOpen] = useState(false);

  // Filter accounts by type
  const availableAccounts = useMemo(() => {
    if (!financialData) {
      return [] as Account[];
    }

    const sourceAccounts: Account[] = [
      ...financialData.liquidAccounts,
      ...(accountTypes.includes('investment') ? financialData.investmentAccounts : [])
    ];
    const allowedTypes = new Set<string>(accountTypes);

    return sourceAccounts.filter(account =>
      allowedTypes.has(String(account.type)) && account.balance > 0
    );
  }, [financialData, accountTypes]);

  if (!financialData) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            No financial data available. Add some accounts and transactions to get started.
          </p>
        </div>
      </div>
    );
  }

  const selectedAccounts = availableAccounts.filter(account => 
    selectedAccountIds.includes(account.id)
  );

  const totalSelectedAmount = selectedAccounts.reduce(
    (sum, account) => sum + account.balance, 
    0
  );

  const firstSelectedAccount = selectedAccounts[0];

  const selectionLabel = selectedAccounts.length === 0
    ? 'Select accounts...'
    : selectedAccounts.length === 1 && firstSelectedAccount
    ? firstSelectedAccount.name
    : `${selectedAccounts.length} accounts selected`;

  const handleAccountToggle = (account: Account): void => {
    let newSelectedIds: string[];
    
    if (selectedAccountIds.includes(account.id)) {
      // Remove account
      newSelectedIds = selectedAccountIds.filter(id => id !== account.id);
    } else {
      // Add account (respect maxSelection)
      if (selectedAccountIds.length >= maxSelection) {
        return; // Don't allow more than maxSelection
      }
      newSelectedIds = [...selectedAccountIds, account.id];
    }
    
    const newSelectedAccounts = availableAccounts.filter(acc => 
      newSelectedIds.includes(acc.id)
    );
    const newTotalAmount = newSelectedAccounts.reduce(
      (sum, acc) => sum + acc.balance, 
      0
    );
    
    onSelectionChange(newSelectedIds, newTotalAmount);
  };

  const getAccountTypeIcon = (type: string): React.ReactNode => {
    switch (type) {
      case 'checking':
        return '💳';
      case 'savings':
        return '🏦';
      case 'current':
        return '💳';
      case 'investment':
        return '📈';
      default:
        return '💰';
    }
  };

  const getAccountTypeName = (type: string): string => {
    switch (type) {
      case 'checking':
        return 'Checking';
      case 'savings':
        return 'Savings';
      case 'current':
        return 'Current';
      case 'investment':
        return 'Investment';
      default:
        return 'Account';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      
      {helpText && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {helpText}
        </p>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg pl-3 pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
        >
          <div className="flex items-center">
            <WalletIcon size={20} className="mr-3 text-gray-400" />
            <span className="block truncate">
              {selectionLabel}
            </span>
          </div>
          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <ChevronDownIcon size={20} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg max-h-60 rounded-lg py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none">
            {availableAccounts.length === 0 ? (
              <div className="px-4 py-2 text-gray-500 dark:text-gray-400">
                No eligible accounts found. Add some checking, savings, or current accounts.
              </div>
            ) : (
              availableAccounts.map((account) => {
                const isSelected = selectedAccountIds.includes(account.id);
                const isDisabled = !isSelected && selectedAccountIds.length >= maxSelection;
                
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => !isDisabled && handleAccountToggle(account)}
                    disabled={isDisabled}
                    className={`relative cursor-pointer select-none py-2 pl-3 pr-9 w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isSelected ? 'bg-blue-50 dark:bg-gray-900/20 text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'
                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="mr-3 text-lg">
                          {getAccountTypeIcon(account.type)}
                        </span>
                        <div>
                          <div className="font-medium">{account.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {getAccountTypeName(account.type)} • {formatCurrency(account.balance)}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="flex items-center text-gray-600 dark:text-gray-500">
                          <CheckIcon size={20} />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      
      {/* Selection Summary */}
      {selectedAccounts.length > 0 && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Total Available for Down Payment:
            </span>
            <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
              {formatCurrency(totalSelectedAmount)}
            </span>
          </div>
          
          {selectedAccounts.length > 1 && (
            <div className="mt-2 space-y-1">
              {selectedAccounts.map((account) => (
                <div key={account.id} className="flex justify-between text-sm">
                  <span className="text-blue-700 dark:text-gray-300">
                    {getAccountTypeIcon(account.type)} {account.name}
                  </span>
                  <span className="text-blue-800 dark:text-blue-200">
                    {formatCurrency(account.balance)}
                  </span>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-500">
            💡 We recommend keeping 20% as emergency buffer ({formatCurrency(totalSelectedAmount * 0.2)})
          </div>
        </div>
      )}
      
      {/* Recommendations */}
      {financialData.recommendations.some(rec => rec.includes('emergency fund')) && (
        <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border-l-4 border-amber-400">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            ⚠️ Consider building your emergency fund before using these accounts for a down payment.
          </p>
        </div>
      )}
    </div>
  );
}
