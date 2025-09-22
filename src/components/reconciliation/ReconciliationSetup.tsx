import { memo, useEffect } from 'react';
import type { Account } from '../../types';
import type { DateRange } from '../../services/reconciliationService';
import { useLogger } from '../services/ServiceProvider';

interface ReconciliationSetupProps {
  selectedAccount: string;
  statementBalance: string;
  dateRange: DateRange;
  accounts: Account[];
  formatCurrency: (amount: number) => string;
  onAccountChange: (accountId: string) => void;
  onStatementBalanceChange: (balance: string) => void;
  onDateRangeChange: (dateRange: DateRange) => void;
}

/**
 * Reconciliation setup component
 * Handles account selection and date range configuration
 */
export const ReconciliationSetup = memo(function ReconciliationSetup({ selectedAccount,
  statementBalance,
  dateRange,
  accounts,
  formatCurrency,
  onAccountChange,
  onStatementBalanceChange,
  onDateRangeChange
 }: ReconciliationSetupProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ReconciliationSetup component initialized', {
      componentName: 'ReconciliationSetup'
    });
  }, []);

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-medium mb-4">Reconciliation Setup</h3>
      
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Account</label>
          <select
            value={selectedAccount}
            onChange={(e) => onAccountChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700"
          >
            <option value="">Select an account...</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({formatCurrency(acc.balance)})
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Statement Balance</label>
          <input
            type="number"
            step="0.01"
            value={statementBalance}
            onChange={(e) => onStatementBalanceChange(e.target.value)}
            placeholder="Enter statement ending balance"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-6 mt-4">
        <div>
          <label className="block text-sm font-medium mb-2">Start Date</label>
          <input
            type="date"
            value={dateRange.start.toISOString().split('T')[0]}
            onChange={(e) => onDateRangeChange({
              ...dateRange,
              start: new Date(e.target.value)
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">End Date</label>
          <input
            type="date"
            value={dateRange.end.toISOString().split('T')[0]}
            onChange={(e) => onDateRangeChange({
              ...dateRange,
              end: new Date(e.target.value)
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700"
          />
        </div>
      </div>
    </div>
  );
});