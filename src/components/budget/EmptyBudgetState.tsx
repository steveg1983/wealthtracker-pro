import { memo, useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface EmptyBudgetStateProps {
  onAddBudget: () => void;
}

export const EmptyBudgetState = memo(function EmptyBudgetState({ onAddBudget  }: EmptyBudgetStateProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('EmptyBudgetState component initialized', {
      componentName: 'EmptyBudgetState'
    });
  }, []);

  return (
    <div className="text-center py-12 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50">
      <svg className="mx-auto text-gray-400 mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <path d="M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0 -6 0"/>
      </svg>
      <p className="text-gray-500 dark:text-gray-400 mb-4">
        No budgets created yet. Click the + button to add your first budget.
      </p>
      <button
        onClick={onAddBudget}
        className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
      >
        Create Your First Budget
      </button>
    </div>
  );
});