import { memo, useState } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import QueryBuilder from '../../components/analytics/QueryBuilder';
import ChartWizard from '../../components/analytics/ChartWizard';
import { useAnalyticsData } from './useAnalyticsData';
import { TabNavigation } from './TabNavigation';
import { KeyMetricsPanel } from './KeyMetricsPanel';
import { DashboardsTab } from './DashboardsTab';
import { InsightsPanel } from './InsightsPanel';
import type { ActiveTab, SavedQuery } from './types';

/**
 * Main Analytics page component
 * Orchestrates analytics features including dashboards, data exploration, and insights
 */
const Analytics = memo(function Analytics() {
  const { transactions, accounts, categories, budgets, goals, investments } = useApp();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboards');
  const [showChartWizard, setShowChartWizard] = useState(false);

  const {
    dashboards,
    activeDashboard,
    setActiveDashboard,
    savedQueries,
    insights,
    selectedData,
    setSelectedData,
    keyMetrics,
    handleSaveDashboard,
    handleDeleteDashboard,
    handleSaveQuery,
    handleRunQuery
  } = useAnalyticsData(
    transactions,
    accounts,
    categories,
    budgets,
    goals,
    investments
  );

  const handleQueryExecute = (query: SavedQuery) => {
    handleSaveQuery(query);
    handleRunQuery(query);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboards':
        return (
          <DashboardsTab
            dashboards={dashboards}
            activeDashboard={activeDashboard}
            onSelectDashboard={setActiveDashboard}
            onSaveDashboard={handleSaveDashboard}
            onDeleteDashboard={handleDeleteDashboard}
          />
        );

      case 'explorer':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Data Explorer
              </h3>
              <QueryBuilder
                onSave={handleQueryExecute}
                onCancel={() => {}}
                initialQuery={undefined}
              />
            </div>
            {selectedData && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <button
                  onClick={() => setShowChartWizard(true)}
                  className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Chart
                </button>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        {selectedData.columns.map((column) => (
                          <th
                            key={column}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {selectedData.rows.map((row, index) => (
                        <tr key={index}>
                          {selectedData.columns.map((column) => (
                            <td
                              key={column}
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white"
                            >
                              {String(row[column] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );

      case 'insights':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Financial Insights
            </h3>
            <InsightsPanel insights={insights} />
          </div>
        );

      case 'reports':
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Custom Reports
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Generate and schedule custom financial reports
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Analyze your financial data with powerful visualization tools
          </p>
        </div>
        <KeyMetricsPanel metrics={keyMetrics} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="px-6 py-4">
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
        <div className="px-6 py-6">
          {renderTabContent()}
        </div>
      </div>

      {showChartWizard && selectedData && (
        <ChartWizard
          data={selectedData}
          onSave={(config) => {
            setShowChartWizard(false);
          }}
          onCancel={() => setShowChartWizard(false)}
        />
      )}
    </div>
  );
});

export default Analytics;