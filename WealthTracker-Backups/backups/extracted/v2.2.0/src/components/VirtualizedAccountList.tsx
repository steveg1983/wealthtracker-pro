import React, { useCallback, useMemo } from 'react';
import { VirtualizedList } from './VirtualizedListSystem';
import { BankIcon, CreditCardIcon, WalletIcon, PiggyBankIcon, TrendingUpIcon } from './icons';
import type { Account } from '../types';

interface VirtualizedAccountListProps {
  accounts: Account[];
  onAccountClick?: (account: Account) => void;
  onAccountEdit?: (account: Account) => void;
  onAccountDelete?: (account: Account) => void;
  showActions?: boolean;
  groupByType?: boolean;
  className?: string;
}

/**
 * High-performance virtualized account list
 * Handles hundreds of accounts smoothly
 */
export function VirtualizedAccountList({
  accounts,
  onAccountClick,
  onAccountEdit,
  onAccountDelete,
  showActions = true,
  groupByType = false,
  className = ''
}: VirtualizedAccountListProps): React.JSX.Element {
  
  // Group accounts by type if requested
  const processedAccounts = useMemo(() => {
    if (!groupByType) return accounts;
    
    const grouped = accounts.reduce((acc, account) => {
      const type = account.type || 'Other';
      if (!acc[type]) acc[type] = [];
      acc[type].push(account);
      return acc;
    }, {} as Record<string, Account[]>);
    
    // Flatten with headers
    const result: (Account | { isHeader: true; title: string })[] = [];
    Object.entries(grouped).forEach(([type, items]) => {
      result.push({ isHeader: true, title: type } as Account | { isHeader: true; title: string });
      result.push(...items);
    });
    
    return result;
  }, [accounts, groupByType]);

  // Get icon for account type
  const getAccountIcon = useCallback((type: string) => {
    switch (type?.toLowerCase()) {
      case 'checking':
      case 'savings':
        return <BankIcon size={20} />;
      case 'credit':
      case 'credit card':
        return <CreditCardIcon size={20} />;
      case 'investment':
      case 'brokerage':
        return <TrendingUpIcon size={20} />;
      case 'retirement':
      case '401k':
      case 'ira':
        return <PiggyBankIcon size={20} />;
      default:
        return <WalletIcon size={20} />;
    }
  }, []);

  // Format currency
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }, []);

  // Render individual account
  const renderAccount = useCallback((item: Account | { isHeader: true; title: string }, index: number, isScrolling?: boolean) => {
    // Check if it's a header
    if (item.isHeader) {
      return (
        <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-gray-700 dark:text-gray-300 sticky top-0 z-10">
          {item.title}
        </div>
      );
    }

    const account = item as Account;
    const isDebt = account.type?.toLowerCase().includes('credit') || 
                   account.type?.toLowerCase().includes('loan');
    
    // Simplified view when scrolling for performance
    if (isScrolling) {
      return (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      );
    }

    return (
      <div
        className="p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors group"
        onClick={() => onAccountClick?.(account)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className={`p-2 rounded-lg ${
              isDebt ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' 
                     : 'bg-blue-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-500'
            }`}>
              {getAccountIcon(account.type)}
            </div>
            
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-white">
                {account.name}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {account.institution} • {account.type}
                {account.accountNumber && ` • ****${account.accountNumber.slice(-4)}`}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={`font-semibold text-lg ${
                account.balance < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'
              }`}>
                {formatCurrency(account.balance)}
              </div>
              {account.available !== undefined && account.available !== account.balance && (
                <div className="text-xs text-gray-500">
                  Available: {formatCurrency(account.available)}
                </div>
              )}
            </div>
            
            {showActions && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAccountEdit?.(account);
                  }}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  aria-label="Edit account"
                >
                  <EditIcon size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAccountDelete?.(account);
                  }}
                  className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600"
                  aria-label="Delete account"
                >
                  <DeleteIcon size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Account tags/labels */}
        {account.tags && account.tags.length > 0 && (
          <div className="flex gap-2 mt-2">
            {account.tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }, [onAccountClick, onAccountEdit, onAccountDelete, showActions, getAccountIcon, formatCurrency]);

  // Calculate item heights for variable size list
  const getItemHeight = useCallback((index: number) => {
    const item = processedAccounts[index];
    if ('isHeader' in item && item.isHeader) return 40;
    if ((item as Account).tags?.length > 0) return 100;
    return 80;
  }, [processedAccounts]);

  return (
    <VirtualizedList
      items={processedAccounts}
      renderItem={renderAccount}
      itemHeight={getItemHeight}
      overscan={5}
      className={className}
      emptyState={
        <div className="p-8 text-center">
          <WalletIcon size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No accounts found</p>
          <button className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary">
            Add Account
          </button>
        </div>
      }
    />
  );
}

// Missing icon imports - let's add simple placeholders
const EditIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} fill="currentColor" viewBox="0 0 20 20">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

const DeleteIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);