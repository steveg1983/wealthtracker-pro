import { memo, useEffect } from 'react';
import { InfoIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

/**
 * Import instructions component
 * Shows supported file formats and instructions
 */
export const ImportInstructions = memo(function ImportInstructions(): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging with error handling
  useEffect(() => {
    try {
      logger.info('ImportInstructions component initialized', {
        componentName: 'ImportInstructions'
      });
    } catch (error) {
      logger.error('ImportInstructions initialization failed:', error);
    }
  }, []);

  try {
    return (
      <>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
        Import your financial data from Microsoft Money or other financial software. 
        Supported formats:
      </p>
      <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-4">
        <li><strong>QIF</strong> - Quicken Interchange Format (recommended for Money users)</li>
        <li><strong>OFX</strong> - Open Financial Exchange</li>
        <li><strong>MNY</strong> - Microsoft Money database files (with manual mapping)</li>
        <li><strong>MBF</strong> - Microsoft Money backup files (with manual mapping)</li>
      </ul>

      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 shadow-md border-l-4 border-amber-400 dark:border-amber-600 mb-4">
        <div className="flex items-start gap-2">
          <InfoIcon className="text-amber-600 dark:text-amber-400 mt-0.5" size={20} />
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-semibold text-gray-900 dark:text-white mb-1">Money File Import:</p>
            <p>For Money .mny or .mbf files, we'll show you the data and let you tell us what each column represents.</p>
          </div>
        </div>
      </div>
      </>
    );
  } catch (error) {
    logger.error('ImportInstructions render failed:', error);
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="text-red-600 dark:text-red-400 text-sm">
          ⚠️ Instructions unavailable
        </div>
      </div>
    );
  }
});