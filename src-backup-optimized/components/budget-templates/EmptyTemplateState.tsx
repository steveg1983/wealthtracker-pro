import { memo, useEffect } from 'react';
import { RepeatIcon, PlusIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface EmptyTemplateStateProps {
  onCreateTemplate: () => void;
}

/**
 * Empty state component for when no templates exist
 * Extracted from RecurringBudgetTemplates for single responsibility
 */
export const EmptyTemplateState = memo(function EmptyTemplateState({ onCreateTemplate 
 }: EmptyTemplateStateProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('EmptyTemplateState component initialized', {
      componentName: 'EmptyTemplateState'
    });
  }, []);

  return (
    <div className="col-span-full bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-8 text-center">
      <RepeatIcon className="mx-auto text-gray-400 mb-4" size={48} />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        No Templates Yet
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Create budget templates to automatically apply recurring budgets
      </p>
      <button
        onClick={onCreateTemplate}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
      >
        <PlusIcon size={16} />
        Create Your First Template
      </button>
    </div>
  );
});