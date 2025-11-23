import { lazy, Suspense, useState, useEffect } from 'react';
import { BanknoteIcon } from '../components/icons';
import { useApp } from '../contexts/AppContextSupabase';
import { usePreferences } from '../contexts/PreferencesContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useLayoutConfig } from '../hooks/useLayoutConfig';
import { SkeletonCard } from '../components/loading/Skeleton';
import PageWrapper from '../components/PageWrapper';

// Lazy load heavy components
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
  const { accounts: _accounts, transactions: _transactions, hasTestData, clearAllData } = useApp();
  const { firstName, setFirstName: _setFirstName, setCurrency: _setCurrency } = usePreferences();
  const { formatCurrency, convertAndSum: _convertAndSum, displayCurrency: _displayCurrency } = useCurrencyDecimal();
  const { layouts: _layouts, updateDashboardLayout: _updateDashboardLayout, resetDashboardLayout: _resetDashboardLayout } = useLayoutConfig();
  const [activeTab, setActiveTab] = useState<'classic' | 'modern' | 'import-export'>('classic');
  const [isLoading, setIsLoading] = useState(true);
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [_showLayoutControls, _setShowLayoutControls] = useState(false);

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
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
      <PageWrapper title="Dashboard">
        <DashboardSkeleton />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Dashboard">
      <Suspense fallback={<DashboardSkeleton />}>
        <div className="space-y-6">
          {/* Tab navigation */}
          <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('classic')}
              className={`pb-2 px-1 ${
                activeTab === 'classic'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Classic Dashboard
            </button>
            <button
              onClick={() => setActiveTab('modern')}
              className={`pb-2 px-1 ${
                activeTab === 'modern'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Modern Dashboard
            </button>
            <button
              onClick={() => setActiveTab('import-export')}
              className={`pb-2 px-1 ${
                activeTab === 'import-export'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
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
                <div className="bg-[#d4dce8] dark:bg-gray-800 p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Total Balance</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(0)}
                      </p>
                    </div>
                    <BanknoteIcon className="w-8 h-8 text-blue-500" />
                  </div>
                </div>
              </div>

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
              onComplete={() => setShowOnboarding(false)}
            />
          </Suspense>
        )}
      </Suspense>
    </PageWrapper>
  );
}