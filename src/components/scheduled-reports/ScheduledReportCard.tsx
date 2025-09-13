import { memo, useEffect } from 'react';
import { format } from 'date-fns';
import type { ScheduledCustomReport } from '../../services/scheduledReportService';
import type { CustomReport } from '../CustomReportBuilder';
import { logger } from '../../services/loggingService';
import {
  ClockIcon,
  MailIcon,
  PlayIcon,
  EditIcon,
  DeleteIcon,
  ToggleLeftIcon,
  ToggleRightIcon
} from '../icons';

interface ScheduledReportCardProps {
  report: ScheduledCustomReport;
  customReport: CustomReport | undefined;
  isRunning: boolean;
  onRun: (report: ScheduledCustomReport) => void;
  onEdit: (report: ScheduledCustomReport) => void;
  onToggle: (report: ScheduledCustomReport) => void;
  onDelete: (reportId: string) => void;
}

/**
 * Individual scheduled report card component
 * Extracted from ScheduledCustomReports for single responsibility
 */
export const ScheduledReportCard = memo(function ScheduledReportCard({
  report,
  customReport,
  isRunning,
  onRun,
  onEdit,
  onToggle,
  onDelete
}: ScheduledReportCardProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('ScheduledReportCard component initialized', {
      componentName: 'ScheduledReportCard'
    });
  }, []);

  const getFrequencyText = () => {
    switch (report.frequency) {
      case 'daily': return 'Daily';
      case 'weekly': return `Weekly on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][report.dayOfWeek || 1]}`;
      case 'monthly': return `Monthly on day ${report.dayOfMonth || 1}`;
      case 'quarterly': return 'Quarterly';
      case 'yearly': return 'Yearly';
      default: return '';
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border ${
        report.enabled 
          ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' 
          : 'bg-blue-50 dark:bg-gray-900 border-gray-300 dark:border-gray-800 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {report.reportName}
            </h3>
            {!report.enabled && (
              <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                Disabled
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <ClockIcon size={16} />
              <span>{getFrequencyText()} at {report.time}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <span className="font-medium">Format:</span>
              <span>{report.deliveryFormat.toUpperCase()}</span>
            </div>
            
            {report.emailRecipients && report.emailRecipients.length > 0 && (
              <div className="flex items-center gap-1">
                <MailIcon size={16} />
                <span>{report.emailRecipients.join(', ')}</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
            <span>
              Next run: {format(new Date(report.nextRun), 'MMM d, yyyy HH:mm')}
            </span>
            {report.lastRun && (
              <span>
                Last run: {format(new Date(report.lastRun), 'MMM d, yyyy HH:mm')}
              </span>
            )}
          </div>
          
          {!customReport && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
              ⚠️ Custom report not found
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onRun(report)}
            disabled={isRunning || !customReport}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary disabled:opacity-50"
            title="Run now"
          >
            {isRunning ? (
              <div className="animate-spin">⏳</div>
            ) : (
              <PlayIcon size={16} />
            )}
          </button>
          
          <button
            onClick={() => onEdit(report)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary"
            title="Edit"
          >
            <EditIcon size={16} />
          </button>
          
          <button
            onClick={() => onToggle(report)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary"
            title={report.enabled ? 'Disable' : 'Enable'}
          >
            {report.enabled ? (
              <ToggleRightIcon size={20} className="text-green-600" />
            ) : (
              <ToggleLeftIcon size={20} />
            )}
          </button>
          
          <button
            onClick={() => onDelete(report.id)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600"
            title="Delete"
          >
            <DeleteIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});