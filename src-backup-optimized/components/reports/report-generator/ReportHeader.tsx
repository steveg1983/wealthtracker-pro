import { memo, useEffect } from 'react';
import { ArrowDownTrayIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useLogger } from '../services/ServiceProvider';

interface ReportHeaderProps {
  title: string;
  isGenerating: boolean;
  onTitleChange: (title: string) => void;
  onGenerate: () => void;
}

/**
 * Report generator header component
 */
export const ReportHeader = memo(function ReportHeader({ title,
  isGenerating,
  onTitleChange,
  onGenerate
 }: ReportHeaderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ReportHeader component initialized', {
      componentName: 'ReportHeader'
    });
  }, []);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Financial Report Generator
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create comprehensive financial reports with customizable sections
          </p>
        </div>
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className={`
            px-6 py-3 rounded-lg font-medium flex items-center gap-2
            ${isGenerating
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gray-600 text-white hover:bg-gray-700'
            }
          `}
        >
          {isGenerating ? (
            <>
              <ClockIcon className="h-5 w-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <ArrowDownTrayIcon className="h-5 w-5" />
              Generate Report
            </>
          )}
        </button>
      </div>

      {/* Report Title */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Report Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
    </>
  );
});