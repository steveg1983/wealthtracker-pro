import { memo, useState } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import PageWrapper from '../../components/PageWrapper';
import { DownloadIcon, PlusIcon, SettingsIcon, CalendarIcon } from '../../components/icons';
import { useExportManager } from './useExportManager';
import { TabNavigation } from './TabNavigation';
import { ExportOptionsPanel } from './ExportOptionsPanel';
import { TemplatesTab } from './TemplatesTab';
import { ScheduledReportsTab } from './ScheduledReportsTab';
import type { ActiveTab } from './types';

/**
 * Export Manager Page Component
 * Orchestrates export functionality, templates, and scheduled reports
 */
export default memo(function ExportManager() {
  const { transactions, accounts, investments = [] } = useApp();
  const [activeTab, setActiveTab] = useState<ActiveTab>('export');
  
  const {
    templates,
    scheduledReports,
    isLoading,
    exportOptions,
    setExportOptions,
    handleExport,
    handleUseTemplate,
    handleSaveAsTemplate,
    handleDeleteTemplate,
    handleCreateScheduledReport,
    handleToggleScheduledReport,
    handleDeleteScheduledReport
  } = useExportManager(transactions, accounts, investments);

  const handleUseTemplateAndSwitch = (template: any) => {
    handleUseTemplate(template);
    setActiveTab('export');
  };

  return (
    <PageWrapper title="Export Manager">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-600 to-purple-600 dark:from-gray-800 dark:to-purple-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Export Manager</h1>
              <p className="text-blue-100">
                Generate reports, schedule exports, and manage templates
              </p>
            </div>
            <DownloadIcon size={48} className="text-white/80" />
          </div>
        </div>

        {/* Tab Navigation */}
        <TabNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          templateCount={templates.length}
          activeReportCount={scheduledReports.filter(r => r.isActive).length}
        />

        {/* Quick Export Tab */}
        {activeTab === 'export' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ExportOptionsPanel
                exportOptions={exportOptions}
                setExportOptions={setExportOptions}
              />
            </div>

            {/* Actions Panel */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions</h3>
                
                <div className="space-y-3">
                  <button
                    onClick={handleExport}
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-secondary)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <DownloadIcon size={20} />
                    {isLoading ? 'Generating...' : 'Generate Export'}
                  </button>
                  
                  <button
                    onClick={handleSaveAsTemplate}
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-2"
                  >
                    <PlusIcon size={20} />
                    Save as Template
                  </button>
                  
                  <button
                    onClick={handleCreateScheduledReport}
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-2"
                  >
                    <SettingsIcon size={20} />
                    Schedule Report
                  </button>
                </div>
              </div>

              {/* Quick Date Presets */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Presets</h3>
                
                <div className="space-y-2">
                  {[
                    { label: 'This Month', start: new Date(new Date().getFullYear(), new Date().getMonth(), 1), end: new Date() },
                    { label: 'Last Month', start: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), end: new Date(new Date().getFullYear(), new Date().getMonth(), 0) },
                    { label: 'This Quarter', start: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1), end: new Date() },
                    { label: 'This Year', start: new Date(new Date().getFullYear(), 0, 1), end: new Date() },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setExportOptions({
                        ...exportOptions,
                        startDate: preset.start,
                        endDate: preset.end
                      })}
                      className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <TemplatesTab
            templates={templates}
            onUseTemplate={handleUseTemplateAndSwitch}
            onDeleteTemplate={handleDeleteTemplate}
          />
        )}

        {/* Scheduled Reports Tab */}
        {activeTab === 'scheduled' && (
          <ScheduledReportsTab
            scheduledReports={scheduledReports}
            onToggleReport={handleToggleScheduledReport}
            onDeleteReport={handleDeleteScheduledReport}
          />
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
            <CalendarIcon size={48} className="text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Export History
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Export history will be displayed here
            </p>
          </div>
        )}
      </div>
    </PageWrapper>
  );
});