import React, { useEffect, memo } from 'react';
import { DatabaseIcon as CloudIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

export const CloudStorageInfo = memo(function CloudStorageInfo(): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('CloudStorageInfo component initialized', {
      componentName: 'CloudStorageInfo'
    });
  }, []);

  return (
    <div className="p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg">
      <div className="flex items-start gap-3">
        <CloudIcon size={20} className="text-gray-600 dark:text-gray-500 mt-0.5" />
        <div>
          <h4 className="font-medium text-blue-900 dark:text-blue-100">
            Cloud Storage Integration Coming Soon
          </h4>
          <p className="text-sm text-blue-700 dark:text-gray-300 mt-1">
            Future updates will include automatic sync to Google Drive, Dropbox, and OneDrive
          </p>
        </div>
      </div>
    </div>
  );
});