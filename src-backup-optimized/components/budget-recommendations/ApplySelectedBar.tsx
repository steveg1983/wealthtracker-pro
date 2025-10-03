/**
 * @component ApplySelectedBar
 * @description Bar for applying multiple selected recommendations at once
 */

import { memo, useEffect } from 'react';
import { CheckIcon } from '../icons';
import type { ApplySelectedBarProps } from './types';
import { useLogger } from '../services/ServiceProvider';

export const ApplySelectedBar = memo(function ApplySelectedBar({ count, 
  onApply 
 }: ApplySelectedBarProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ApplySelectedBar component initialized', {
      componentName: 'ApplySelectedBar'
    });
  }, []);

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4 flex items-center justify-between">
      <span className="text-blue-900 dark:text-blue-100">
        {count} recommendation{count !== 1 ? 's' : ''} selected
      </span>
      <button
        onClick={onApply}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
      >
        <CheckIcon size={16} />
        Apply Selected
      </button>
    </div>
  );
});