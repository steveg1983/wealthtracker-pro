import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useNotifications } from '../contexts/NotificationContext';
import { customReportService } from '../services/customReportService';
import CustomReportBuilder from '../components/CustomReportBuilder';
import ScheduledCustomReports from '../components/ScheduledCustomReports';
import type { CustomReport } from '../components/CustomReportBuilder';
import {
  PlusIcon,
  FileTextIcon,
  EditIcon,
  DeleteIcon,
  PlayIcon,
  CalendarIcon,
  CopyIcon
} from '../components/icons';
import { format } from 'date-fns';

export default function CustomReports(): React.JSX.Element {
  const { transactions, accounts, budgets, categories } = useApp();
  const { addNotification } = useNotifications();
  
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingReport, setEditingReport] = useState<CustomReport | undefined>();
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [_generatedData, _setGeneratedData] = useState<unknown>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = () => {
    const customReports = customReportService.getCustomReports();
    setReports(customReports);
  };

  const handleSaveReport = (report: CustomReport) => {
    customReportService.saveCustomReport(report);
    loadReports();
    setShowBuilder(false);
    setEditingReport(undefined);
    
    addNotification({
      type: 'success',
      title: 'Report Saved',
      message: `${report.name} has been saved successfully`
    });
  };

  const handleDeleteReport = (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) {
      return;
    }
    
    customReportService.deleteCustomReport(reportId);
    loadReports();
    
    addNotification({
      type: 'success',
      title: 'Report Deleted',
      message: 'The report has been deleted'
    });
  };

  const handleDuplicateReport = (report: CustomReport) => {
    const duplicate: CustomReport = {
      ...report,
      id: `report-${Date.now()}`,
      name: `${report.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    customReportService.saveCustomReport(duplicate);
    loadReports();
    
    addNotification({
      type: 'success',
      title: 'Report Duplicated',
      message: 'The report has been duplicated'
    });
  };

  const handleGenerateReport = async (report: CustomReport) => {
    setGeneratingReport(report.id);
    
    try {
      const data = await customReportService.generateReportData(report, {
        transactions,
        accounts,
        budgets,
        categories
      });
      
      setGeneratedData(data);
      
      // Navigate to report viewer
      // For now, just show a success message
      addNotification({
        type: 'success',
        title: 'Report Generated',
        message: 'Your report has been generated successfully'
      });
    } catch {
      addNotification({
        type: 'error',
        title: 'Generation Failed',
        message: 'Failed to generate the report'
      });
    } finally {
      setGeneratingReport(null);
    }
  };

  if (showBuilder || editingReport) {
    return (
      <CustomReportBuilder
        report={editingReport}
        onSave={handleSaveReport}
        onCancel={() => {
          setShowBuilder(false);
          setEditingReport(undefined);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Custom Reports
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Create and manage your personalized financial reports
            </p>
          </div>
          <button
            onClick={() => setShowBuilder(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <PlusIcon size={20} />
            Create Report
          </button>
        </div>
      </div>

      {/* Report Templates */}
      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Start Templates
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => {
              setEditingReport({
                id: '',
                name: 'Monthly Summary',
                description: 'Overview of income, expenses, and savings',
                components: [
                  {
                    id: 'stats',
                    type: 'summary-stats',
                    title: 'Key Metrics',
                    config: { metrics: ['income', 'expenses', 'netIncome', 'savingsRate'] },
                    width: 'full'
                  },
                  {
                    id: 'trend',
                    type: 'line-chart',
                    title: 'Income vs Expenses Trend',
                    config: { dataType: 'income-vs-expenses' },
                    width: 'full'
                  },
                  {
                    id: 'categories',
                    type: 'pie-chart',
                    title: 'Spending by Category',
                    config: { dataType: 'expenses-by-category' },
                    width: 'half'
                  }
                ],
                filters: { dateRange: 'month' },
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }}
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
          >
            <h3 className="font-medium text-gray-900 dark:text-white">Monthly Summary</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Income, expenses, and category breakdown
            </p>
          </button>
          
          <button
            onClick={() => {
              setEditingReport({
                id: '',
                name: 'Budget vs Actual',
                description: 'Compare budgeted amounts with actual spending',
                components: [
                  {
                    id: 'budget',
                    type: 'category-breakdown',
                    title: 'Budget Performance',
                    config: { showSubcategories: true, comparisonType: 'budget' },
                    width: 'full'
                  }
                ],
                filters: { dateRange: 'month' },
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }}
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
          >
            <h3 className="font-medium text-gray-900 dark:text-white">Budget vs Actual</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Track budget performance by category
            </p>
          </button>
          
          <button
            onClick={() => {
              setEditingReport({
                id: '',
                name: 'Year-over-Year',
                description: 'Compare current year with previous year',
                components: [
                  {
                    id: 'comparison',
                    type: 'date-comparison',
                    title: 'Year Comparison',
                    config: { periods: ['current', 'previous'], metric: 'all' },
                    width: 'full'
                  }
                ],
                filters: { dateRange: 'year' },
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }}
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
          >
            <h3 className="font-medium text-gray-900 dark:text-white">Year-over-Year</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Annual comparison and trends
            </p>
          </button>
        </div>
      </div>

      {/* Saved Reports */}
      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Your Reports
        </h2>
        
        {reports.length === 0 ? (
          <div className="text-center py-12">
            <FileTextIcon size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              No custom reports yet. Create your first report to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map(report => (
              <div
                key={report.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {report.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {report.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                      <CalendarIcon size={14} />
                      Created {format(new Date(report.createdAt), 'MMM d, yyyy')}
                    </span>
                    <span>
                      {report.components.length} component{report.components.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleGenerateReport(report)}
                    disabled={generatingReport === report.id}
                    className="p-2 text-primary hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50"
                    title="Generate Report"
                  >
                    {generatingReport === report.id ? (
                      <div className="animate-spin">⏳</div>
                    ) : (
                      <PlayIcon size={18} />
                    )}
                  </button>
                  
                  <button
                    onClick={() => setEditingReport(report)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
                    title="Edit"
                  >
                    <EditIcon size={18} />
                  </button>
                  
                  <button
                    onClick={() => handleDuplicateReport(report)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
                    title="Duplicate"
                  >
                    <CopyIcon size={18} />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteReport(report.id)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
                    title="Delete"
                  >
                    <DeleteIcon size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheduled Reports Section */}
      <div className="bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow-sm p-6">
        <ScheduledCustomReports />
      </div>
    </div>
  );
}