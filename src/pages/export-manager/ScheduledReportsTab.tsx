import { memo } from 'react';
import { ClockIcon, MailIcon, PlayIcon, StopIcon, TrashIcon, CalendarIcon } from '../../components/icons';
import type { ScheduledReport } from './types';

interface ScheduledReportsTabProps {
  scheduledReports: ScheduledReport[];
  onToggleReport: (id: string) => void;
  onDeleteReport: (id: string) => void;
}

/**
 * Tab for managing scheduled export reports
 * Displays and controls automated report generation
 */
export const ScheduledReportsTab = memo(function ScheduledReportsTab({
  scheduledReports,
  onToggleReport,
  onDeleteReport
}: ScheduledReportsTabProps) {
  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFrequencyLabel = (frequency: ScheduledReport['frequency']) => {
    const labels = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly'
    };
    return labels[frequency];
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
      : 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30';
  };

  if (scheduledReports.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
        <ClockIcon size={48} className="text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Scheduled Reports
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Set up automated reports to be generated and emailed on a schedule
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Report Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Frequency
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Next Run
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {scheduledReports.map((report) => (
            <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {report.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Format: {report.options.format.toUpperCase()}
                  </p>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center space-x-2">
                  <CalendarIcon size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {getFrequencyLabel(report.frequency)}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center space-x-2">
                  <MailIcon size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {report.email}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <p className="text-sm text-gray-900 dark:text-white">
                  {report.nextRun ? formatDateTime(report.nextRun) : 'Not scheduled'}
                </p>
                {report.lastRun && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Last: {formatDateTime(report.lastRun)}
                  </p>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(report.isActive)}`}>
                  {report.isActive ? 'Active' : 'Paused'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => onToggleReport(report.id)}
                    className={`${
                      report.isActive 
                        ? 'text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300'
                        : 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300'
                    }`}
                    title={report.isActive ? 'Pause Report' : 'Resume Report'}
                  >
                    {report.isActive ? <StopIcon size={20} /> : <PlayIcon size={20} />}
                  </button>
                  <button
                    onClick={() => onDeleteReport(report.id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    title="Delete Report"
                  >
                    <TrashIcon size={20} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});