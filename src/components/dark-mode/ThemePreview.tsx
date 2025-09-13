import { memo, useEffect } from 'react';
import { logger } from '../../services/loggingService';

/**
 * Theme preview component
 * Shows a preview of current theme settings
 */
export const ThemePreview = memo(function ThemePreview(): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ThemePreview component initialized', {
      componentName: 'ThemePreview'
    });
  }, []);

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Preview</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-900 dark:text-white font-medium">
            Sample Text
          </span>
          <span className="text-primary">Primary Color</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Secondary Text
          </span>
          <span className="text-green-600 dark:text-green-400">Success</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-500">
            Muted Text
          </span>
          <span className="text-red-600 dark:text-red-400">Error</span>
        </div>
      </div>
    </div>
  );
});