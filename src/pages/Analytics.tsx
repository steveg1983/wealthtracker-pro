import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { 
  BarChart3Icon, 
  TrendingUpIcon, 
  ArrowUpRightIcon, 
  ArrowDownRightIcon,
  PlusIcon,
  GridIcon,
  LightbulbIcon,
  DownloadIcon,
  PlayIcon
} from '../components/icons';
import { analyticsEngine } from '../services/analyticsEngine';
import { anomalyDetectionService } from '../services/anomalyDetectionService';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import PageWrapper from '../components/PageWrapper';

// Lazy load heavy components to reduce bundle size
const DashboardBuilder = lazy(() => import('../components/analytics/DashboardBuilder'));
const QueryBuilder = lazy(() => import('../components/analytics/QueryBuilder').then(module => ({ default: module.default, Query: module.Query })));
const ChartWizard = lazy(() => import('../components/analytics/ChartWizard'));
const AgGridReact = lazy(() => import('ag-grid-react').then(module => ({ default: module.AgGridReact })));

// Import AG-Grid styles
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Import Query type
import type { Query } from '../components/analytics/QueryBuilder';

interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: any[];
  layout: any[];
  createdAt: Date;
  updatedAt: Date;
}

interface SavedQuery extends Query {
  lastRun?: Date;
  results?: any;
}

export default function Analytics(): React.JSX.Element {
  const { transactions, accounts, categories, budgets, goals, investments } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  
  const [activeTab, setActiveTab] = useState<'dashboards' | 'explorer' | 'insights' | 'reports'>('dashboards');
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);
  const [showChartWizard, setShowChartWizard] = useState(false);
  const [showDashboardBuilder, setShowDashboardBuilder] = useState(false);
  const [selectedData, setSelectedData] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  
  // Load saved dashboards and queries from localStorage
  useEffect(() => {
    const savedDashboards = localStorage.getItem('analytics_dashboards');
    if (savedDashboards) {
      setDashboards(JSON.parse(savedDashboards));
    }
    
    const savedQueriesData = localStorage.getItem('analytics_queries');
    if (savedQueriesData) {
      setSavedQueries(JSON.parse(savedQueriesData));
    }
    
    // Generate initial insights
    generateInsights();
  }, []);
  
  const generateInsights = async () => {
    const newInsights = [];
    
    // Spending trends
    const spendingTrend = analyticsEngine.detectSeasonalPatterns(transactions, 'expenses');
    if (spendingTrend.direction !== 'stable') {
      newInsights.push({
        type: 'trend',
        title: `Spending is ${spendingTrend.direction}`,
        description: `Your spending has ${spendingTrend.direction === 'increasing' ? 'increased' : 'decreased'} by ${Math.abs(spendingTrend.changeRate * 100).toFixed(1)}% over the last 30 days`,
        severity: spendingTrend.direction === 'increasing' ? 'warning' : 'success'
      });
    }
    
    // Category analysis
    const categoryAnalysis = analyticsEngine.performCohortAnalysis(transactions, 'category', 'amount');
    const topCategory = Object.entries(categoryAnalysis.segments)
      .sort((a: any, b: any) => b[1].total - a[1].total)[0];
    if (topCategory) {
      newInsights.push({
        type: 'category',
        title: `Highest spending category: ${topCategory[0]}`,
        description: `You've spent ${formatCurrency(topCategory[1].total)} in ${topCategory[0]} this month`,
        severity: 'info'
      });
    }
    
    // Anomaly detection - NOW ENABLED
    try {
      const anomalies = await anomalyDetectionService.detectAnomalies(transactions, categories);
      
      if (anomalies.length > 0) {
        newInsights.push({
          type: 'anomaly',
          title: `${anomalies.length} unusual transaction${anomalies.length > 1 ? 's' : ''} detected`,
          description: 'Review these transactions for potential errors or fraud',
          severity: 'warning'
        });
        
        // Add specific anomaly details
        anomalies.slice(0, 3).forEach(anomaly => {
          newInsights.push({
            type: 'anomaly',
            title: `${anomaly.type.replace(/_/g, ' ').charAt(0).toUpperCase() + anomaly.type.replace(/_/g, ' ').slice(1)}`,
            description: anomaly.description,
            severity: anomaly.severity as 'info' | 'warning' | 'success'
          });
        });
      }
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      // Don't fail the entire insights generation if anomaly detection fails
    }
    
    setInsights(newInsights);
  };
  
  const executeQuery = (query: Query) => {
    // Execute query against data
    let results: any[] = [];
    
    switch (query.dataSource) {
      case 'transactions':
        results = [...transactions];
        break;
      case 'accounts':
        results = [...accounts];
        break;
      case 'budgets':
        results = [...budgets];
        break;
      case 'goals':
        results = [...goals];
        break;
      case 'investments':
        results = [...investments];
        break;
    }
    
    // Apply filters
    query.conditions.forEach(condition => {
      results = results.filter(item => {
        const value = item[condition.field];
        switch (condition.operator) {
          case 'equals':
            return value === condition.value;
          case 'contains':
            return value?.toString().includes(condition.value);
          case 'greater':
            return parseFloat(value) > parseFloat(condition.value);
          case 'less':
            return parseFloat(value) < parseFloat(condition.value);
          case 'between':
            return parseFloat(value) >= parseFloat(condition.value) && 
                   parseFloat(value) <= parseFloat(condition.value2);
          default:
            return true;
        }
      });
    });
    
    // Apply sorting
    query.sortBy.forEach(sort => {
      results.sort((a, b) => {
        const aVal = a[sort.field];
        const bVal = b[sort.field];
        const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        return sort.direction === 'asc' ? comparison : -comparison;
      });
    });
    
    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }
    
    return results;
  };
  
  const handleSaveQuery = (query: Query) => {
    const results = executeQuery(query);
    const savedQuery: SavedQuery = {
      ...query,
      lastRun: new Date(),
      results
    };
    
    const updatedQueries = [...savedQueries, savedQuery];
    setSavedQueries(updatedQueries);
    localStorage.setItem('analytics_queries', JSON.stringify(updatedQueries));
    setShowQueryBuilder(false);
    setSelectedData(results);
  };
  
  const handleSaveDashboard = (dashboard: Dashboard) => {
    const updatedDashboards = [...dashboards, dashboard];
    setDashboards(updatedDashboards);
    localStorage.setItem('analytics_dashboards', JSON.stringify(updatedDashboards));
    setShowDashboardBuilder(false);
    setActiveDashboard(dashboard);
  };
  
  const handleAddChart = (chartConfig: any) => {
    // Add chart to current dashboard or create new widget
    setShowChartWizard(false);
  };
  
  // Calculate key metrics
  const keyMetrics = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    
    return {
      totalIncome: income,
      totalExpenses: expenses,
      savingsRate,
      transactionCount: transactions.length
    };
  }, [transactions]);
  
  return (
    <PageWrapper title="Analytics">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Professional-grade financial analytics and insights
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowQueryBuilder(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <GridIcon size={16} />
                  New Query
                </button>
                <button
                  onClick={() => setShowChartWizard(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <BarChart3Icon size={16} />
                  New Chart
                </button>
                <button
                  onClick={() => setShowDashboardBuilder(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  <PlusIcon size={16} />
                  New Dashboard
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-6 mt-6">
              {[
                { id: 'dashboards', label: 'Dashboards', icon: GridIcon },
                { id: 'explorer', label: 'Data Explorer', icon: GridIcon },
                { id: 'insights', label: 'AI Insights', icon: LightbulbIcon },
                { id: 'reports', label: 'Reports', icon: DownloadIcon }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <tab.icon size={18} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Key Metrics */}
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Income</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(keyMetrics.totalIncome)}
                  </p>
                </div>
                <ArrowUpRightIcon className="text-green-500" size={24} />
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(keyMetrics.totalExpenses)}
                  </p>
                </div>
                <ArrowDownRightIcon className="text-red-500" size={24} />
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Savings Rate</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {keyMetrics.savingsRate.toFixed(1)}%
                  </p>
                </div>
                <TrendingUpIcon className="text-blue-500" size={24} />
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Transactions</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {keyMetrics.transactionCount}
                  </p>
                </div>
                <BarChart3Icon className="text-purple-500" size={24} />
              </div>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {activeTab === 'dashboards' && (
            <div>
              {activeDashboard ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {activeDashboard.name}
                    </h2>
                    <button
                      onClick={() => setActiveDashboard(null)}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                      Back to Dashboards
                    </button>
                  </div>
                  <Suspense fallback={<div className="flex items-center justify-center h-64">Loading dashboard...</div>}>
                    <DashboardBuilder
                      dashboard={activeDashboard}
                      onSave={handleSaveDashboard}
                      onClose={() => setActiveDashboard(null)}
                    />
                  </Suspense>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {dashboards.map(dashboard => (
                    <div
                      key={dashboard.id}
                      onClick={() => setActiveDashboard(dashboard)}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md cursor-pointer transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <GridIcon size={24} className="text-primary" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(dashboard.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {dashboard.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {dashboard.description}
                      </p>
                      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                        {dashboard.widgets.length} widgets
                      </div>
                    </div>
                  ))}
                  
                  {/* Empty state */}
                  {dashboards.length === 0 && (
                    <div className="col-span-full text-center py-12">
                      <GridIcon size={48} className="mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No dashboards yet
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Create your first dashboard to visualize your financial data
                      </p>
                      <button
                        onClick={() => setShowDashboardBuilder(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                      >
                        <PlusIcon size={16} />
                        Create Dashboard
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'explorer' && (
            <div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Saved Queries
                  </h2>
                  <button
                    onClick={() => setShowQueryBuilder(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
                  >
                    <PlusIcon size={14} />
                    New Query
                  </button>
                </div>
                
                {savedQueries.length > 0 ? (
                  <div className="space-y-3">
                    {savedQueries.map(query => (
                      <div
                        key={query.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {query.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {query.dataSource} • {query.conditions.length} filters • 
                            Last run: {query.lastRun ? new Date(query.lastRun).toLocaleString() : 'Never'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const results = executeQuery(query);
                            setSelectedData(results);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
                        >
                          <PlayIcon size={14} />
                          Run
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <GridIcon size={32} className="mx-auto text-gray-400 dark:text-gray-600 mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No saved queries yet. Create your first query to explore your data.
                    </p>
                  </div>
                )}
                
                {/* Results Grid */}
                {selectedData && selectedData.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Query Results ({selectedData.length} rows)
                    </h3>
                    <div className="ag-theme-alpine-dark" style={{ height: 400 }}>
                      <Suspense fallback={<div className="flex items-center justify-center h-full">Loading grid...</div>}>
                        <AgGridReact
                          rowData={selectedData}
                          columnDefs={Object.keys(selectedData[0] || {}).map(key => ({
                            field: key,
                            sortable: true,
                            filter: true,
                            resizable: true
                          }))}
                          defaultColDef={{
                            flex: 1,
                            minWidth: 100
                          }}
                        />
                      </Suspense>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'insights' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 p-6 ${
                    insight.severity === 'warning' ? 'border-l-amber-500' :
                    insight.severity === 'success' ? 'border-l-green-500' :
                    'border-l-blue-500'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <LightbulbIcon size={20} className={
                      insight.severity === 'warning' ? 'text-amber-500' :
                      insight.severity === 'success' ? 'text-green-500' :
                      'text-blue-500'
                    } />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {insight.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              {insights.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <LightbulbIcon size={48} className="mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Generating insights from your financial data...
                  </p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'reports' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
              <div className="text-center">
                <DownloadIcon size={48} className="mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Report Generation Coming Soon
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Generate professional PDF reports with your custom dashboards and insights
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Modals */}
        {showQueryBuilder && (
          <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">Loading...</div>}>
            <QueryBuilder
              onSave={handleSaveQuery}
              onCancel={() => setShowQueryBuilder(false)}
            />
          </Suspense>
        )}
        
        {showChartWizard && selectedData && (
          <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">Loading...</div>}>
            <ChartWizard
              data={selectedData}
              onSave={handleAddChart}
              onCancel={() => setShowChartWizard(false)}
            />
          </Suspense>
        )}
        
        {showDashboardBuilder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <Suspense fallback={<div className="flex items-center justify-center h-full p-8">Loading...</div>}>
                <DashboardBuilder
                  onSave={handleSaveDashboard}
                  onClose={() => setShowDashboardBuilder(false)}
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}