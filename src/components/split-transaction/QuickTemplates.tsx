import { memo, useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface QuickTemplatesProps {
  splitCount: number;
  onDistribute: (percentages: number[]) => void;
}

export const QuickTemplates = memo(function QuickTemplates({ splitCount,
  onDistribute
 }: QuickTemplatesProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('QuickTemplates component initialized', {
      componentName: 'QuickTemplates'
    });
  }, []);

  return (
    <div className="mt-6 p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
      <p className="text-sm font-medium text-blue-900 dark:text-gray-300 mb-3">
        Quick Split Templates:
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onDistribute([50, 50])}
          disabled={splitCount !== 2}
          className="px-3 py-1 text-xs bg-white dark:bg-gray-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50"
        >
          50/50
        </button>
        <button
          onClick={() => onDistribute([60, 40])}
          disabled={splitCount !== 2}
          className="px-3 py-1 text-xs bg-white dark:bg-gray-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50"
        >
          60/40
        </button>
        <button
          onClick={() => onDistribute([70, 30])}
          disabled={splitCount !== 2}
          className="px-3 py-1 text-xs bg-white dark:bg-gray-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50"
        >
          70/30
        </button>
        <button
          onClick={() => onDistribute([33.33, 33.33, 33.34])}
          disabled={splitCount !== 3}
          className="px-3 py-1 text-xs bg-white dark:bg-gray-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50"
        >
          Thirds
        </button>
        <button
          onClick={() => onDistribute([25, 25, 25, 25])}
          disabled={splitCount !== 4}
          className="px-3 py-1 text-xs bg-white dark:bg-gray-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50"
        >
          Quarters
        </button>
      </div>
    </div>
  );
});