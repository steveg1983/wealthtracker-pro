import React, { useEffect, memo } from 'react';
import { useLogger } from '../services/ServiceProvider';
import {
  ClockIcon,
  FileTextIcon,
  PlayIcon,
  EditIcon,
  CheckIcon,
  XIcon
} from '../icons';

export interface ScheduledReport {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string;
  format: 'pdf' | 'csv' | 'summary';
  includeCharts: boolean;
  recipients?: string[];
  lastRun?: Date;
  nextRun: Date;
  enabled: boolean;
  reportConfig: {
    dateRange: 'month' | 'quarter' | 'year' | 'custom';
    customDays?: number;
    includeAccounts: string[];
    includeCategories?: string[];
  };
}

interface ReportListItemProps {
  report: ScheduledReport;
  onRunNow: (report: ScheduledReport) => void;
  onEdit: (report: ScheduledReport) => void;
  onToggleEnabled: (reportId: string, enabled: boolean) => void;
  onDelete: (reportId: string) => void;
}

export const ReportListItem = memo(function ReportListItem({ report,
  onRunNow,
  onEdit,
  onToggleEnabled,
  onDelete
 }: ReportListItemProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ReportListItem component initialized', {
      componentName: 'ReportListItem'
    });
  }, []);

  const getDayName = (day: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];

  const getFrequencyText = () => {
    switch (report.frequency) {
      case 'daily':
        return 'Daily';
      case 'weekly':
        return `Weekly on ${getDayName(report.dayOfWeek || 1)}`;
      case 'monthly':
        return `Monthly on day ${report.dayOfMonth || 1}`;
      case 'quarterly':
        return 'Quarterly';
      case 'yearly':
        return 'Yearly';
      default:
        return report.frequency;
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border ${
        report.enabled 
          ? 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600' 
          : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-medium text-gray-900 dark:text-white">{report.name}</h3>
            {!report.enabled && (
              <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                Disabled
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <ClockIcon size={16} />
              <span>
                {getFrequencyText()} at {report.time}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <FileTextIcon size={16} />
              <span>{report.format.toUpperCase()}</span>
            </div>
            
            <div>
              Next run: {new Date(report.nextRun).toLocaleString()}
            </div>
            
            {report.lastRun && (
              <div>
                Last run: {new Date(report.lastRun).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onRunNow(report)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary"
            title="Run now"
          >
            <PlayIcon size={16} />
          </button>
          
          <button
            onClick={() => onEdit(report)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary"
          >
            <EditIcon size={16} />
          </button>
          
          <button
            onClick={() => onToggleEnabled(report.id, !report.enabled)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary"
          >
            {report.enabled ? <CheckIcon size={16} /> : <XIcon size={16} />}
          </button>
          
          <button
            onClick={() => onDelete(report.id)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
          >
            <XIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});