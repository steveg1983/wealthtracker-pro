import { useState, useEffect, useMemo, lazy, Suspense, memo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { usePreferences } from '../contexts/PreferencesContext';
import PageWrapper from '../components/PageWrapper';
import { SkeletonCard } from '../components/loading/Skeleton';
import { useTranslation } from '../hooks/useTranslation';

// Lazy load only modals and heavy features for better performance
const TestDataWarningModal = lazy(() => import('../components/TestDataWarningModal'));
const OnboardingModal = lazy(() => import('../components/OnboardingModal'));
const ImprovedDashboard = lazy(() => import('../components/dashboard/ImprovedDashboard').then(module => ({ default: module.ImprovedDashboard })));
const EnhancedDraggableDashboard = lazy(() => import('../components/dashboard/EnhancedDraggableDashboard'));


const prefersDraggableDashboard = () =>
  typeof window !== 'undefined' && window.localStorage.getItem('preferDraggableDashboard') === 'true';

const readLocalStorage = (key: string) => (typeof window !== 'undefined' ? window.localStorage.getItem(key) : null);
const writeLocalStorage = (key: string, value: string) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, value);
};

const Dashboard = memo(function Dashboard() {
  const { accounts, clearAllData } = useApp();
  const { firstName, setFirstName, setCurrency } = usePreferences();
  const { t } = useTranslation();
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [useDraggableDashboard, setUseDraggableDashboard] = useState<boolean>(() => prefersDraggableDashboard());

  const hasTestData = useMemo(
    () => accounts.some(acc => acc.name === 'Main Checking' || acc.name === 'Savings Account'),
    [accounts]
  );
  
  // Check for test data on component mount
  useEffect(() => {
    if (hasTestData) {
      const warningDismissed = readLocalStorage('testDataWarningDismissed');
      if (warningDismissed !== 'true') {
        setShowTestDataWarning(true);
      }
    }
  }, [hasTestData, accounts.length]);

  // Check if onboarding should be shown
  useEffect(() => {
    const onboardingCompleted = readLocalStorage('onboardingCompleted');
    if (!onboardingCompleted && !firstName && !showTestDataWarning) {
      setShowOnboarding(true);
    }
  }, [firstName, showTestDataWarning]);

  // Handle onboarding completion
  const handleOnboardingComplete = (name: string, currency: string) => {
    setFirstName(name);
    setCurrency(currency);
    writeLocalStorage('onboardingCompleted', 'true');
    setShowOnboarding(false);
  };

  // Handle test data warning close
  const handleTestDataWarningClose = () => {
    setShowTestDataWarning(false);
    // Check if we should show onboarding after warning closes
    const onboardingCompleted = readLocalStorage('onboardingCompleted');
    if (!onboardingCompleted && !firstName) {
      setShowOnboarding(true);
    }
  };

  return (
    <PageWrapper title={t('navigation.dashboard')}>
      {/* Dashboard Type Toggle */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            const newValue = !useDraggableDashboard;
            setUseDraggableDashboard(newValue);
            writeLocalStorage('preferDraggableDashboard', String(newValue));
          }}
          className="text-sm text-gray-600 hover:text-blue-700 dark:text-gray-500 dark:hover:text-gray-300 underline"
        >
          {useDraggableDashboard 
            ? t('dashboard.switchToStandard', 'Switch to Standard Dashboard')
            : t('dashboard.switchToCustomizable', 'Switch to Customizable Dashboard')}
        </button>
      </div>
      
      {/* Render the appropriate dashboard */}
      <Suspense fallback={<SkeletonCard className="h-96" />}>
        {useDraggableDashboard ? <EnhancedDraggableDashboard /> : <ImprovedDashboard />}
      </Suspense>
      
      {/* Test Data Warning Modal */}
      <TestDataWarningModal
        isOpen={showTestDataWarning}
        onClose={handleTestDataWarningClose}
        onClearData={() => {
          clearAllData();
          handleTestDataWarningClose();
        }}
      />

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
      />
    </PageWrapper>
  );
});

export default Dashboard;
