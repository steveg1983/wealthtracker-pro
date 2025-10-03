import { memo, useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface ScanProgressProps {
  progress: number;
}

/**
 * Scan progress component
 * Shows progress bar while scanning for duplicates
 */
export const ScanProgress = memo(function ScanProgress({ progress  }: ScanProgressProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ScanProgress component initialized', {
      componentName: 'ScanProgress'
    });
  }, []);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Scanning for duplicates...</span>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
});