import { memo, useEffect } from 'react';
import { ArrowRightIcon } from '../icons';
import type { Account } from '../../types';
import type { TransferFormData, TransferErrors } from './types';
import { logger } from '../../services/loggingService';

interface AccountSelectionRowProps {
  formData: TransferFormData;
  setFormData: React.Dispatch<React.SetStateAction<TransferFormData>>;
  accounts: Account[];
  targetAccounts: Account[];
  errors: TransferErrors;
}

export const AccountSelectionRow = memo(function AccountSelectionRow({
  formData,
  setFormData,
  accounts,
  targetAccounts,
  errors
}: AccountSelectionRowProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('AccountSelectionRow component initialized', {
      componentName: 'AccountSelectionRow'
    });
  }, []);

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            From Account
          </label>
          <select
            value={formData.sourceAccountId}
            onChange={(e) => setFormData({ ...formData, sourceAccountId: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            required
          >
            <option value="">Select account...</option>
            {accounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency} {account.balance?.toLocaleString()})
              </option>
            ))}
          </select>
          {errors.sourceAccountId && (
            <p className="text-red-500 text-xs mt-1">{errors.sourceAccountId}</p>
          )}
        </div>
        
        <div className="flex justify-center">
          <ArrowRightIcon size={24} className="text-gray-400" />
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            To Account
          </label>
          <select
            value={formData.targetAccountId}
            onChange={(e) => setFormData({ ...formData, targetAccountId: e.target.value })}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            required
            disabled={!formData.sourceAccountId}
          >
            <option value="">Select account...</option>
            {targetAccounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency} {account.balance?.toLocaleString()})
              </option>
            ))}
          </select>
          {errors.targetAccountId && (
            <p className="text-red-500 text-xs mt-1">{errors.targetAccountId}</p>
          )}
        </div>
      </div>
    </div>
  );
});