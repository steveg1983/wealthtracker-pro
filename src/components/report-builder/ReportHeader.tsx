import { memo, useEffect } from 'react';
import { SaveIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface ReportHeaderProps {
  reportName: string;
  reportDescription: string;
  isEdit: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * Report header component with title and actions
 */
export const ReportHeader = memo(function ReportHeader({
  reportName,
  reportDescription,
  isEdit,
  onNameChange,
  onDescriptionChange,
  onSave,
  onCancel
}: ReportHeaderProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ReportHeader component initialized', {
      componentName: 'ReportHeader'
    });
  }, []);

  return (
    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isEdit ? 'Edit Report' : 'Create Custom Report'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <SaveIcon size={16} />
            Save Report
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Report Name
          </label>
          <input
            type="text"
            value={reportName}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Monthly Financial Summary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <input
            type="text"
            value={reportDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Overview of monthly income, expenses, and savings"
          />
        </div>
      </div>
    </div>
  );
});