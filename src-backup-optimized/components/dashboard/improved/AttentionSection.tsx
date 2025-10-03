import { memo, useEffect } from 'react';
import { AlertCircleIcon, WalletIcon, ChevronRightIcon } from '../../icons';
import type { Account } from '../../../types';
import { useLogger } from '../services/ServiceProvider';

interface AttentionSectionProps {
  accountsNeedingAttention: Account[];
}

/**
 * Accounts needing attention section
 */
export const AttentionSection = memo(function AttentionSection({ accountsNeedingAttention
 }: AttentionSectionProps): React.JSX.Element | null {
  // Component initialization logging
  useEffect(() => {
    logger.info('AttentionSection component initialized', {
      componentName: 'AttentionSection'
    });
  }, []);

  if (accountsNeedingAttention.length === 0) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <AlertCircleIcon size={24} className="text-yellow-600 dark:text-yellow-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Needs Your Attention
        </h3>
      </div>
      
      <div className="space-y-3">
        {accountsNeedingAttention.map(account => (
          <div 
            key={account.id}
            className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <WalletIcon size={20} className="text-gray-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {account.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {(account.type === 'current' || account.type === 'checking') && account.balance < 500 && 'Low balance'}
                  {(() => {
                    type CreditAccount = Account & { creditLimit?: number };
                    const acc = account as CreditAccount;
                    return account.type === 'credit' && typeof acc.creditLimit === 'number' &&
                      acc.creditLimit > 0 && Math.abs(account.balance) / acc.creditLimit > 0.7
                      ? 'High utilization'
                      : '';
                  })()}
                </p>
              </div>
            </div>
            <ChevronRightIcon size={20} className="text-gray-400" />
          </div>
        ))}
      </div>
    </div>
  );
});
