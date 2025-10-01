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
const QueryBuilder = lazy(() => import('../components/analytics/QueryBuilder'));
const ChartWizard = lazy(() => import('../components/analytics/ChartWizard'));
const AgGridReact = lazy(() => import('ag-grid-react').then(module => ({ default: module.AgGridReact })));

// Import AG-Grid styles
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Import type helpers
import type { Query } from '../components/analytics/QueryBuilder';
import type { Dashboard as BuilderDashboard } from '../components/analytics/DashboardBuilder';
import type { ColDef } from 'ag-grid-community';
import { logger } from '../services/loggingService';

type Dashboard = BuilderDashboard;

interface SavedQuery extends Query {
  lastRun?: Date;
  results?: any;
}

type QueryRow = Record<string, unknown>;

export default function Analytics(): React.JSX.Element {
  const appContext = useApp();
  const {
    transactions,
    accounts,
    categories,
    budgets,
    goals,
    investments: contextInvestments
  } = appContext;
  const investments = contextInvestments ?? [];
  const { formatCurrency } = useCurrencyDecimal();
  
  const [activeTab, setActiveTab] = useState<'dashboards' | 'explorer' | 'insights' | 'reports'>('dashboards');
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<Dashboard | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);
  const [showChartWizard, setShowChartWizard] = useState(false);
  const [showDashboardBuilder, setShowDashboardBuilder] = useState(false);
  const [selectedData, setSelectedData] = useState<Record<string, unknown>[] | null>(null);
  const [insights, setInsights] = useState<any[]>([]);
  
  const deserializeDashboard = (raw: any): Dashboard => ({
    ...raw,
    createdAt: raw?.createdAt ? new Date(raw.createdAt) : new Date(),
    updatedAt: raw?.updatedAt ? new Date(raw.updatedAt) : new Date(),
    widgets: Array.isArray(raw?.widgets) ? raw.widgets : [],
    settings: raw?.settings ?? {}
  });

  const serializeDashboards = (items: Dashboard[]): string =>
    JSON.stringify(
      items.map(dashboard => ({
        ...dashboard,
        createdAt: dashboard.createdAt.toISOString(),
        updatedAt: dashboard.updatedAt.toISOString()
      }))
    );

  const serializeQueries = (items: SavedQuery[]): string =>
    JSON.stringify(
      items.map(query => ({
        ...query,
        lastRun: query.lastRun ? new Date(query.lastRun).toISOString() : undefined
      }))
    );

  const deserializeQueries = (raw: any[]): SavedQuery[] =>
    raw.map(item => ({
      ...item,
      lastRun: item?.lastRun ? new Date(item.lastRun) : undefined
    }));

  // Load saved dashboards and queries from localStorage
  useEffect(() => {
    try {
      const savedDashboards = localStorage.getItem('analytics_dashboards');
      if (savedDashboards) {
        const parsed = JSON.parse(savedDashboards);
        if (Array.isArray(parsed)) {
          setDashboards(parsed.map(deserializeDashboard));
        }
      }
    } catch (error) {
      logger.error('Failed to load dashboards from storage', error);
    }

    try {
      const savedQueriesData = localStorage.getItem('analytics_queries');
      if (savedQueriesData) {
        const parsed = JSON.parse(savedQueriesData);
        if (Array.isArray(parsed)) {
          setSavedQueries(deserializeQueries(parsed));
        }
      }
    } catch (error) {
      logger.error('Failed to load queries from storage', error);
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
    const categoryCohorts = analyticsEngine.performCohortAnalysis(
      transactions,
      accounts,
      'category',
      'value'
    );

    const sortedCategories = categoryCohorts
      .map(cohort => ({
        name: cohort.cohort,
        total: cohort.periods.reduce((sum, period) => sum + period.value, 0)
      }))
      .sort((a, b) => b.total - a.total);

    const topCategory = sortedCategories[0];

    if (topCategory && topCategory.total > 0) {
      newInsights.push({
        type: 'category',
        title: `Highest spending category: ${topCategory.name}`,
        description: `You've spent ${formatCurrency(topCategory.total)} in ${topCategory.name} this month`,
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
      logger.error('Error detecting anomalies:', error);
      // Don't fail the entire insights generation if anomaly detection fails
    }
    
    setInsights(newInsights);
  };

  const executeQuery = (query: Query): Record<string, unknown>[] => {
    const cloneRecords = <T extends Record<string, unknown>>(items: T[]): Record<string, unknown>[] =>
      items.map(item => ({ ...item }));

    let results: Record<string, unknown>[];

    switch (query.dataSource) {
      case 'transactions':
        results = cloneRecords(transactions as unknown as Record<string, unknown>[]);
        break;
      case 'accounts':
        results = cloneRecords(accounts as unknown as Record<string, unknown>[]);
        break;
      case 'budgets':
        results = cloneRecords(budgets as unknown as Record<string, unknown>[]);
        break;
      case 'goals':
        results = cloneRecords(goals as unknown as Record<string, unknown>[]);
        break;
      case 'investments':
        results = cloneRecords(investments as unknown as Record<string, unknown>[]);
        break;
      default:
        results = [];
    }

    const toNumber = (input: unknown): number | null => {
      if (typeof input === 'number') {
        return input;
      }
      const parsed = Number(input);
      return Number.isNaN(parsed) ? null : parsed;
    };

    const toStringValue = (input: unknown): string => {
      if (input === null || input === undefined) {
        return '';
      }
      return String(input);
    };

    query.conditions.forEach(condition => {
      results = results.filter(item => {
        const value = item[condition.field];

        switch (condition.operator) {
          case 'equals':
            return value === condition.value;
          case 'contains': {
            const target = toStringValue(condition.value).toLowerCase();
            return toStringValue(value).toLowerCase().includes(target);
          }
          case 'greater': {
            const numericValue = toNumber(value);
            const numericTarget = toNumber(condition.value);
            return numericValue !== null && numericTarget !== null && numericValue > numericTarget;
          }
          case 'less': {
            const numericValue = toNumber(value);
            const numericTarget = toNumber(condition.value);
            return numericValue !== null && numericTarget !== null && numericValue < numericTarget;
          }
          case 'between': {
            const numericValue = toNumber(value);
            const min = toNumber(condition.value);
            const max = toNumber(condition.value2);
            return (
              numericValue !== null &&
              min !== null &&
              max !== null &&
              numericValue >= min &&
              numericValue <= max
            );
          }
          case 'in': {
            const candidates = Array.isArray(condition.value)
              ? condition.value
              : String(condition.value).split(',');
            if (Array.isArray(value)) {
              const normalized = value.map(toStringValue);
              return candidates.some(candidate => normalized.includes(String(candidate)));
            }
            return candidates.map(String).includes(toStringValue(value));
          }
          case 'not_in': {
            const candidates = Array.isArray(condition.value)
              ? condition.value
              : String(condition.value).split(',');
            if (Array.isArray(value)) {
              const normalized = value.map(toStringValue);
              return candidates.every(candidate => !normalized.includes(String(candidate)));
            }
            return !candidates.map(String).includes(toStringValue(value));
          }
          default:
            return true;
        }
      });
    });

    const compareValues = (a: unknown, b: unknown): number => {
      if (a === b) {
        return 0;
      }

      const aNumber = toNumber(a);
      const bNumber = toNumber(b);

      if (aNumber !== null && bNumber !== null) {
        return aNumber - bNumber;
      }

      const aString = toStringValue(a);
      const bString = toStringValue(b);
      return aString.localeCompare(bString, undefined, { sensitivity: 'base' });
    };

    query.sortBy.forEach(sort => {
      results.sort((a, b) => {
        const comparison = compareValues(a[sort.field], b[sort.field]);
        return sort.direction === 'asc' ? comparison : -comparison;
      });
    });

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
    localStorage.setItem('analytics_queries', serializeQueries(updatedQueries));
    setShowQueryBuilder(false);
    setSelectedData(results);
  };
  
  const handleSaveDashboard = (dashboard: Dashboard) => {
    const normalizedDashboard: Dashboard = {
      ...dashboard,
      createdAt: dashboard.createdAt ? new Date(dashboard.createdAt) : new Date(),
      updatedAt: dashboard.updatedAt ? new Date(dashboard.updatedAt) : new Date()
    };

    const updatedDashboards = dashboards.some(d => d.id === normalizedDashboard.id)
      ? dashboards.map(d => (d.id === normalizedDashboard.id ? normalizedDashboard : d))
      : [...dashboards, normalizedDashboard];
    setDashboards(updatedDashboards);
    localStorage.setItem('analytics_dashboards', serializeDashboards(updatedDashboards));
    setShowDashboardBuilder(false);
    setActiveDashboard(normalizedDashboard);
  };
  
  const handleAddChart = (chartConfig: any) => {
    // Add chart to current dashboard or create new widget
    setShowChartWizard(false);
  };

  // Calculate key metrics
  const keyMetrics = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)), 0);
    
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)), 0);
    
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    
    return {
      totalIncome: income,
      totalExpenses: expenses,
      savingsRate,
      transactionCount: transactions.length
    };
  }, [transactions]);

  const queryColumnDefs = useMemo<ColDef<QueryRow>[]>(() => {
    if (!selectedData || selectedData.length === 0) {
      return [];
    }

    const [firstRow] = selectedData;
    if (!firstRow) {
      return [];
    }

    const columnKeys = Object.keys(firstRow) as Array<keyof typeof firstRow>;

    return columnKeys.map(key => ({
      field: key as string,
      sortable: true,
      filter: true,
      resizable: true
    }));
  }, [selectedData]);

  const gridColumnDefs = useMemo(() => queryColumnDefs as unknown as ColDef<unknown, any>[], [queryColumnDefs]);
  
  return (
    <PageWrapper title="Analytics">
      <div className="min-h-screen bg-blue-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
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
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
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
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Savings Rate</p>
                  <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
                    {keyMetrics.savingsRate.toFixed(1)}%
                  </p>
                </div>
                <TrendingUpIcon className="text-gray-500" size={24} />
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
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
                          rowData={selectedData ?? []}
                          columnDefs={gridColumnDefs}
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
                      'text-gray-500'
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
