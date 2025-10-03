import { memo, useEffect } from 'react';
import { DatabaseIcon } from '../icons';
import type { DataStats } from '../../services/dataManagementPageService';
import { useLogger } from '../services/ServiceProvider';

interface DataManagementHeaderProps {
  dataStats: DataStats;
  hasTestData: boolean;
}

export const DataManagementHeader = memo(function DataManagementHeader({ dataStats, 
  hasTestData 
 }: DataManagementHeaderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('DataManagementHeader component initialized', {
      componentName: 'DataManagementHeader'
    });
  }, []);

  return (
    <div className="bg-gradient-to-r from-gray-600 to-indigo-600 dark:from-gray-800 dark:to-indigo-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Data Management</h1>
          <p className="text-blue-100">
            Import, export, and manage your financial data
          </p>
        </div>
        <DatabaseIcon size={48} className="text-white/80" />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
        <div>
          <p className="text-sm text-blue-100">Accounts</p>
          <p className="text-xl font-semibold">{dataStats.accounts}</p>
        </div>
        <div>
          <p className="text-sm text-blue-100">Transactions</p>
          <p className="text-xl font-semibold">{dataStats.transactions}</p>
        </div>
        <div>
          <p className="text-sm text-blue-100">Budgets</p>
          <p className="text-xl font-semibold">{dataStats.budgets}</p>
        </div>
        <div>
          <p className="text-sm text-blue-100">Categories</p>
          <p className="text-xl font-semibold">{dataStats.categories}</p>
        </div>
        <div>
          <p className="text-sm text-blue-100">Goals</p>
          <p className="text-xl font-semibold">{dataStats.goals}</p>
        </div>
      </div>
      
      {hasTestData && (
        <div className="mt-4 p-3 bg-orange-500/20 rounded-lg border border-orange-400/30">
          <p className="text-sm font-medium">Test Data Active</p>
          <p className="text-xs mt-1 text-blue-100">
            Clear test data before importing real bank data
          </p>
        </div>
      )}
    </div>
  );
});