import { memo, useState, useEffect } from 'react';
import type { ScheduledCustomReport } from '../../services/scheduledReportService';
import { scheduledReportService } from '../../services/scheduledReportService';
import type { CustomReport } from '../CustomReportBuilder';
import { XIcon } from '../icons';
import { useLogger } from '../services/ServiceProvider';

interface ScheduleReportModalProps {
  scheduledReport: ScheduledCustomReport | null;
  customReports: CustomReport[];
  onSave: (report: ScheduledCustomReport) => void;
  onClose: () => void;
}

/**
 * Modal for creating/editing scheduled reports
 * Extracted from ScheduledCustomReports for single responsibility
 */
export const ScheduleReportModal = memo(function ScheduleReportModal({ scheduledReport,
  customReports,
  onSave,
  onClose
 }: ScheduleReportModalProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('ScheduleReportModal component initialized', {
      componentName: 'ScheduleReportModal'
    });
  }, []);

  const [formData, setFormData] = useState<Partial<ScheduledCustomReport>>({
    customReportId: scheduledReport?.customReportId || '',
    reportName: scheduledReport?.reportName || '',
    frequency: scheduledReport?.frequency || 'monthly',
    dayOfWeek: scheduledReport?.dayOfWeek || 1,
    dayOfMonth: scheduledReport?.dayOfMonth || 1,
    time: scheduledReport?.time || '09:00',
    deliveryFormat: scheduledReport?.deliveryFormat || 'pdf',
    emailRecipients: scheduledReport?.emailRecipients || [],
    enabled: scheduledReport?.enabled ?? true
  });

  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    // Auto-fill report name when custom report is selected
    if (formData.customReportId && !scheduledReport) {
      const customReport = customReports.find(r => r.id === formData.customReportId);
      if (customReport) {
        setFormData(prev => ({ ...prev, reportName: customReport.name }));
      }
    }
  }, [formData.customReportId, customReports, scheduledReport]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const report: ScheduledCustomReport = {
      id: scheduledReport?.id || `scheduled-${Date.now()}`,
      customReportId: formData.customReportId!,
      reportName: formData.reportName!,
      frequency: formData.frequency!,
      dayOfWeek: formData.dayOfWeek,
      dayOfMonth: formData.dayOfMonth,
      time: formData.time!,
      deliveryFormat: formData.deliveryFormat!,
      emailRecipients: formData.emailRecipients,
      enabled: formData.enabled!,
      nextRun: scheduledReportService.calculateNextRun({
        frequency: formData.frequency!,
        dayOfWeek: formData.dayOfWeek,
        dayOfMonth: formData.dayOfMonth,
        time: formData.time!
      } as ScheduledCustomReport),
      createdAt: scheduledReport?.createdAt || new Date(),
      updatedAt: new Date()
    };
    
    onSave(report);
  };

  const addEmail = () => {
    if (emailInput && emailInput.includes('@')) {
      setFormData(prev => ({
        ...prev,
        emailRecipients: [...(prev.emailRecipients || []), emailInput]
      }));
      setEmailInput('');
    }
  };

  const removeEmail = (email: string) => {
    setFormData(prev => ({
      ...prev,
      emailRecipients: prev.emailRecipients?.filter(e => e !== email) || []
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {scheduledReport ? 'Edit Scheduled Report' : 'Schedule New Report'}
            </h3>
          </div>
          
          <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
            {/* Custom Report Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Report Template
              </label>
              <select
                value={formData.customReportId}
                onChange={(e) => setFormData({ ...formData, customReportId: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                required
              >
                <option value="">Select a report...</option>
                {customReports.map(report => (
                  <option key={report.id} value={report.id}>
                    {report.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Report Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Schedule Name
              </label>
              <input
                type="text"
                value={formData.reportName}
                onChange={(e) => setFormData({ ...formData, reportName: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                required
              />
            </div>

            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Frequency
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as ScheduledCustomReport['frequency'] })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {/* Day of Week (for weekly) */}
            {formData.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Day of Week
                </label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </div>
            )}

            {/* Day of Month (for monthly) */}
            {formData.frequency === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Day of Month
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dayOfMonth}
                  onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
              </div>
            )}

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
              />
            </div>

            {/* Delivery Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Delivery Format
              </label>
              <select
                value={formData.deliveryFormat}
                onChange={(e) => setFormData({ ...formData, deliveryFormat: e.target.value as ScheduledCustomReport['deliveryFormat'] })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="email">Email (with PDF attachment)</option>
              </select>
            </div>

            {/* Email Recipients */}
            {formData.deliveryFormat === 'email' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Recipients
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                    placeholder="email@example.com"
                  />
                  <button
                    type="button"
                    onClick={addEmail}
                    className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                  >
                    Add
                  </button>
                </div>
                {formData.emailRecipients && formData.emailRecipients.length > 0 && (
                  <div className="space-y-1">
                    {formData.emailRecipients.map(email => (
                      <div key={email} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded">
                        <span className="text-sm">{email}</span>
                        <button
                          type="button"
                          onClick={() => removeEmail(email)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XIcon size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              {scheduledReport ? 'Save Changes' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});