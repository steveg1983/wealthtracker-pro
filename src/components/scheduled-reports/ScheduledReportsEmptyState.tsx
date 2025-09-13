import { memo, useEffect } from 'react';
import { CalendarIcon } from '../icons';
import { logger } from '../../services/loggingService';

interface ScheduledReportsEmptyStateProps {
  onCreateReport: () => void;
}

/**
 * Empty state component for scheduled reports
 * Extracted from ScheduledCustomReports for single responsibility
 */
export const ScheduledReportsEmptyState = memo(function ScheduledReportsEmptyState({
  onCreateReport
}: ScheduledReportsEmptyStateProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ScheduledReportsEmptyState component initialized', {
      componentName: 'ScheduledReportsEmptyState'
    });
  }, []);

  return (
    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <CalendarIcon size={48} className="mx-auto text-gray-400 mb-4" />
      <p className="text-gray-600 dark:text-gray-400">
        No scheduled reports yet
      </p>
      <button
        onClick={onCreateReport}
        className="mt-4 text-primary hover:underline"
      >
        Create your first scheduled report
      </button>
    </div>
  );
});