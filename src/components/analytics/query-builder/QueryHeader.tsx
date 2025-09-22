import { memo, useEffect } from 'react';
import type { Query } from '../../../services/queryBuilderService';
import { useLogger } from '../services/ServiceProvider';

interface QueryHeaderProps {
  queryName: string;
  dataSource: Query['dataSource'];
  onNameChange: (name: string) => void;
  onDataSourceChange: (source: Query['dataSource']) => void;
  onResetFields: () => void;
}

/**
 * Query header component
 * Handles query name and data source selection
 */
export const QueryHeader = memo(function QueryHeader({ queryName,
  dataSource,
  onNameChange,
  onDataSourceChange,
  onResetFields
 }: QueryHeaderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('QueryHeader component initialized', {
      componentName: 'QueryHeader'
    });
  }, []);

  const handleDataSourceChange = (newSource: Query['dataSource']) => {
    onDataSourceChange(newSource);
    onResetFields();
  };

  return (
    <>
      {/* Query Name */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Query Name
        </label>
        <input
          type="text"
          value={queryName}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Monthly Expense Analysis"
        />
      </div>

      {/* Data Source */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Data Source
        </label>
        <select
          value={dataSource}
          onChange={(e) => handleDataSourceChange(e.target.value as Query['dataSource'])}
          className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
        >
          <option value="transactions">Transactions</option>
          <option value="accounts">Accounts</option>
          <option value="budgets">Budgets</option>
          <option value="goals">Goals</option>
          <option value="investments">Investments</option>
        </select>
      </div>
    </>
  );
});