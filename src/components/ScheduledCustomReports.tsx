import React, { useState, useEffect } from 'react';
import { scheduledReportService, type ScheduledCustomReport } from '../services/scheduledReportService';
import { customReportService } from '../services/customReportService';
import { useApp } from '../contexts/AppContextSupabase';
import { useNotifications } from '../contexts/NotificationContext';
import type { CustomReport } from './CustomReportBuilder';
import {
  CalendarIcon,
  ClockIcon,
  MailIcon,
  PlusIcon,
  EditIcon,
  DeleteIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  PlayIcon,
  XIcon
} from './icons';
import { format } from 'date-fns';

export default function ScheduledCustomReports(): React.JSX.Element {
  const { transactions, accounts, budgets, categories } = useApp();
  const { addNotification } = useNotifications();
  
  const [scheduledReports, setScheduledReports] = useState<ScheduledCustomReport[]>([]);
  const [customReports, setCustomReports] = useState<CustomReport[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledCustomReport | null>(null);
  const [runningReport, setRunningReport] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // Initialize the scheduled report service
    scheduledReportService.initialize();
    
    return () => {
      scheduledReportService.destroy();
    };
  }, []);

  const loadData = () => {
    setScheduledReports(scheduledReportService.getScheduledReports());
    setCustomReports(customReportService.getCustomReports());
  };

  const handleSaveScheduledReport = (report: ScheduledCustomReport) => {
    scheduledReportService.saveScheduledReport(report);
    loadData();
    setShowAddModal(false);
    setEditingReport(null);
    
    addNotification({
      type: 'success',
      title: 'Schedule Saved',
      message: `${report.reportName} has been scheduled successfully`
    });
  };

  const handleDeleteScheduledReport = (reportId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) {
      return;
    }
    
    scheduledReportService.deleteScheduledReport(reportId);
    loadData();
    
    addNotification({
      type: 'success',
      title: 'Schedule Deleted',
      message: 'The scheduled report has been deleted'
    });
  };

  const handleToggleEnabled = (report: ScheduledCustomReport) => {
    const updated = { ...report, enabled: !report.enabled };
    scheduledReportService.saveScheduledReport(updated);
    loadData();
  };

  const handleRunNow = async (report: ScheduledCustomReport) => {
    setRunningReport(report.id);
    
    try {
      await scheduledReportService.runScheduledReport(report, {
        transactions,
        accounts,
        budgets,
        categories
      });
      
      addNotification({
        type: 'success',
        title: 'Report Generated',
        message: `${report.reportName} has been generated successfully`
      });
      
      loadData(); // Reload to show updated last run time
    } catch (error) {
      console.error('Failed to run scheduled report:', error);
      addNotification({
        type: 'error',
        title: 'Report Failed',
        message: `Failed to generate ${report.reportName}`
      });
    } finally {
      setRunningReport(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Scheduled Reports
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Automate report generation and delivery
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <PlusIcon size={16} />
          Schedule Report
        </button>
      </div>

      {/* Scheduled Reports List */}
      {scheduledReports.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <CalendarIcon size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            No scheduled reports yet
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 text-primary hover:underline"
          >
            Create your first scheduled report
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {scheduledReports.map(report => {
            const customReport = customReports.find(r => r.id === report.customReportId);
            
            return (
              <div
                key={report.id}
                className={`p-4 rounded-lg border ${
                  report.enabled 
                    ? 'bg-card-bg-light dark:bg-card-bg-dark border-gray-200 dark:border-gray-700' 
                    : 'bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-800 opacity-60'
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
                        <span>
                          {report.frequency === 'daily' && 'Daily'}
                          {report.frequency === 'weekly' && `Weekly on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][report.dayOfWeek || 1]}`}
                          {report.frequency === 'monthly' && `Monthly on day ${report.dayOfMonth || 1}`}
                          {report.frequency === 'quarterly' && 'Quarterly'}
                          {report.frequency === 'yearly' && 'Yearly'}
                          {' at '}{report.time}
                        </span>
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
                      onClick={() => handleRunNow(report)}
                      disabled={runningReport === report.id || !customReport}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary disabled:opacity-50"
                      title="Run now"
                    >
                      {runningReport === report.id ? (
                        <div className="animate-spin">⏳</div>
                      ) : (
                        <PlayIcon size={16} />
                      )}
                    </button>
                    
                    <button
                      onClick={() => setEditingReport(report)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary"
                      title="Edit"
                    >
                      <EditIcon size={16} />
                    </button>
                    
                    <button
                      onClick={() => handleToggleEnabled(report)}
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
                      onClick={() => handleDeleteScheduledReport(report.id)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600"
                      title="Delete"
                    >
                      <DeleteIcon size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingReport) && (
        <ScheduleReportModal
          scheduledReport={editingReport}
          customReports={customReports}
          onSave={handleSaveScheduledReport}
          onClose={() => {
            setShowAddModal(false);
            setEditingReport(null);
          }}
        />
      )}
    </div>
  );
}

// Schedule Report Modal
interface ScheduleReportModalProps {
  scheduledReport: ScheduledCustomReport | null;
  customReports: CustomReport[];
  onSave: (report: ScheduledCustomReport) => void;
  onClose: () => void;
}

function ScheduleReportModal({
  scheduledReport,
  customReports,
  onSave,
  onClose
}: ScheduleReportModalProps): React.JSX.Element {
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
    
    const baseReport: ScheduledCustomReport = {
      id: scheduledReport?.id || `scheduled-${Date.now()}`,
      customReportId: formData.customReportId ?? '',
      reportName: formData.reportName ?? '',
      frequency: formData.frequency ?? 'monthly',
      dayOfWeek: formData.dayOfWeek,
      dayOfMonth: formData.dayOfMonth,
      time: formData.time ?? '09:00',
      deliveryFormat: formData.deliveryFormat ?? 'pdf',
      emailRecipients: formData.emailRecipients ?? [],
      enabled: formData.enabled ?? true,
      nextRun: scheduledReport?.nextRun ?? new Date(),
      lastRun: scheduledReport?.lastRun,
      createdAt: scheduledReport?.createdAt || new Date(),
      updatedAt: new Date()
    };

    const nextRun = scheduledReportService.calculateNextRun(baseReport);

    const report: ScheduledCustomReport = {
      ...baseReport,
      nextRun
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
      <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
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
                className="w-full px-3 py-2 bg-card-bg-light dark:bg-card-bg-dark border border-gray-300 dark:border-gray-600 rounded-lg"
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
                className="w-full px-3 py-2 bg-card-bg-light dark:bg-card-bg-dark border border-gray-300 dark:border-gray-600 rounded-lg"
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
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    frequency: e.target.value as ScheduledCustomReport['frequency']
                  })
                }
                className="w-full px-3 py-2 bg-card-bg-light dark:bg-card-bg-dark border border-gray-300 dark:border-gray-600 rounded-lg"
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
                  className="w-full px-3 py-2 bg-card-bg-light dark:bg-card-bg-dark border border-gray-300 dark:border-gray-600 rounded-lg"
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
                  className="w-full px-3 py-2 bg-card-bg-light dark:bg-card-bg-dark border border-gray-300 dark:border-gray-600 rounded-lg"
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
                className="w-full px-3 py-2 bg-card-bg-light dark:bg-card-bg-dark border border-gray-300 dark:border-gray-600 rounded-lg"
              />
            </div>

            {/* Delivery Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Delivery Format
              </label>
              <select
                value={formData.deliveryFormat}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    deliveryFormat: e.target.value as ScheduledCustomReport['deliveryFormat']
                  })
                }
                className="w-full px-3 py-2 bg-card-bg-light dark:bg-card-bg-dark border border-gray-300 dark:border-gray-600 rounded-lg"
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
                    className="flex-1 px-3 py-2 bg-card-bg-light dark:bg-card-bg-dark border border-gray-300 dark:border-gray-600 rounded-lg"
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
}
