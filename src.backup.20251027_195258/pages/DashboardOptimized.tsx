import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { BanknoteIcon } from '../components/icons';
import { useApp } from '../contexts/AppContextSupabase';
import { usePreferences } from '../contexts/PreferencesContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { SkeletonCard } from '../components/loading/Skeleton';
import PageWrapper from '../components/PageWrapper';
import type { LineBarChartData, LineBarChartOptions } from '../components/charts/OptimizedChart';
import { format, subMonths } from 'date-fns';
import { toDecimal } from '@wealthtracker/utils';

// Lazy load heavy components
const LazyOptimizedChart = lazy(() => import('../components/charts/OptimizedChart'));
const TestDataWarningModal = lazy(() => import('../components/TestDataWarningModal'));
const OnboardingModal = lazy(() => import('../components/OnboardingModal'));
const CustomizableDashboard = lazy(() => import('../components/CustomizableDashboard'));
const DataImportExport = lazy(() => import('../components/DataImportExport'));

// Loading fallback component
const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <SkeletonCard key={i} className="h-32" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SkeletonCard className="h-64" />
      <SkeletonCard className="h-64" />
    </div>
  </div>
);

export default function DashboardOptimized() {
  const { accounts, transactions, clearAllData } = useApp();
  const { firstName, setFirstName, setCurrency } = usePreferences();
  const { formatCurrency } = useCurrencyDecimal();
  const [activeTab, setActiveTab] = useState<'classic' | 'modern' | 'import-export'>('classic');
  const [isLoading, setIsLoading] = useState(true);
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [chartsLoaded, setChartsLoaded] = useState(false);

  const hasTestData = useMemo(
    () => accounts.some(account => account.name === 'Main Checking' || account.name === 'Savings Account'),
    [accounts]
  );

  const incomeExpenseChart = useMemo<LineBarChartData>(() => {
    const now = new Date();
    const monthLabels: string[] = [];
    const monthBuckets = new Map<string, { income: number; expenses: number }>();

    for (let offset = 5; offset >= 0; offset -= 1) {
      const monthDate = subMonths(now, offset);
      const label = format(monthDate, 'MMM yyyy');
      monthLabels.push(label);
      monthBuckets.set(label, { income: 0, expenses: 0 });
    }

    transactions.forEach(transaction => {
      const rawDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
      if (Number.isNaN(rawDate.getTime())) {
        return;
      }
      const label = format(new Date(rawDate.getFullYear(), rawDate.getMonth(), 1), 'MMM yyyy');
      const bucket = monthBuckets.get(label);
      if (!bucket) {
        return;
      }

      const amountDecimal = toDecimal(transaction.amount);
      if (transaction.type === 'income') {
        bucket.income += amountDecimal.toNumber();
      } else if (transaction.type === 'expense') {
        bucket.expenses += Math.abs(amountDecimal.toNumber());
      }
    });

    const chartRows = monthLabels.map(label => ({
      month: label,
      income: monthBuckets.get(label)?.income ?? 0,
      expenses: monthBuckets.get(label)?.expenses ?? 0
    }));

    return {
      xKey: 'month',
      data: chartRows,
      datasets: [
        {
          key: 'income',
          name: 'Income',
          color: '#16a34a',
          strokeWidth: 2,
          type: 'monotone'
        },
        {
          key: 'expenses',
          name: 'Expenses',
          color: '#ef4444',
          strokeWidth: 2,
          type: 'monotone'
        }
      ]
    };
  }, [transactions]);

  const incomeExpenseOptions = useMemo<LineBarChartOptions>(() => ({
    title: 'Income vs Expenses (Last 6 Months)',
    legendPosition: 'top',
    tooltipFormatter: value => formatCurrency(value),
    yAxisFormatter: value => formatCurrency(value),
    showDots: false,
    showGrid: true
  }), [formatCurrency]);

  const handleOnboardingComplete = (name: string, currency: string) => {
    setFirstName(name);
    setCurrency(currency);
    setShowOnboarding(false);
  };

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      // Load charts after initial render
      if (typeof window !== 'undefined') {
        const idle = (window as typeof window & { requestIdleCallback?: (cb: IdleRequestCallback) => void }).requestIdleCallback;
        if (typeof idle === 'function') {
          idle(() => setChartsLoaded(true));
          return;
        }
      }
      setChartsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Check for test data and onboarding
  useEffect(() => {
    if (!isLoading) {
      if (hasTestData) {
        setShowTestDataWarning(true);
      } else if (!firstName) {
        setShowOnboarding(true);
      }
    }
  }, [hasTestData, firstName, isLoading]);

  if (isLoading) {
    return (
      <PageWrapper title="Optimized Dashboard">
        <DashboardSkeleton />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Optimized Dashboard">
      <Suspense fallback={<DashboardSkeleton />}>
        <div className="space-y-6">
          {/* Tab navigation */}
          <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('classic')}
              className={`pb-2 px-1 ${
                activeTab === 'classic'
                  ? 'border-b-2 border-gray-500 text-gray-600 dark:text-gray-500'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Classic Dashboard
            </button>
            <button
              onClick={() => setActiveTab('modern')}
              className={`pb-2 px-1 ${
                activeTab === 'modern'
                  ? 'border-b-2 border-gray-500 text-gray-600 dark:text-gray-500'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Modern Dashboard
            </button>
            <button
              onClick={() => setActiveTab('import-export')}
              className={`pb-2 px-1 ${
                activeTab === 'import-export'
                  ? 'border-b-2 border-gray-500 text-gray-600 dark:text-gray-500'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Import/Export
            </button>
          </div>

          {/* Content based on active tab */}
          {activeTab === 'classic' && (
            <div className="space-y-6">
              {/* Quick stats will load immediately */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Total Balance</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(0)}
                      </p>
                    </div>
                    <BanknoteIcon className="w-8 h-8 text-gray-500" />
                  </div>
                </div>
              </div>

              {/* Charts load after initial render */}
              {chartsLoaded && (
                <div className="h-80">
                  <Suspense fallback={<SkeletonCard className="h-80" />}>
                    <LazyOptimizedChart
                      type="line"
                      data={incomeExpenseChart}
                      options={incomeExpenseOptions}
                      height={320}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          )}

          {activeTab === 'modern' && (
            <Suspense fallback={<DashboardSkeleton />}>
              <CustomizableDashboard />
            </Suspense>
          )}

          {activeTab === 'import-export' && (
            <Suspense fallback={<SkeletonCard className="h-96" />}>
              <DataImportExport />
            </Suspense>
          )}
        </div>

        {/* Modals load only when needed */}
        {showTestDataWarning && (
          <Suspense fallback={null}>
            <TestDataWarningModal
              isOpen={showTestDataWarning}
              onClose={() => setShowTestDataWarning(false)}
              onClearData={clearAllData}
            />
          </Suspense>
        )}

        {showOnboarding && (
          <Suspense fallback={null}>
            <OnboardingModal
              isOpen={showOnboarding}
              onComplete={handleOnboardingComplete}
            />
          </Suspense>
        )}
      </Suspense>
    </PageWrapper>
  );
}
