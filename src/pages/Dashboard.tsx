import { useState, useEffect, lazy, Suspense, memo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { usePreferences } from '../contexts/PreferencesContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PageWrapper from '../components/PageWrapper';
import { SkeletonCard } from '../components/loading/Skeleton';
import { lazyLogger as logger } from '../services/serviceFactory';
import { useTranslation } from '../hooks/useTranslation';

// Lazy load only modals and heavy features for better performance
const TestDataWarningModal = lazy(() => import('../components/TestDataWarningModal'));
const OnboardingModal = lazy(() => import('../components/OnboardingModal'));
const ImprovedDashboard = lazy(() => import('../components/dashboard/ImprovedDashboard').then(module => ({ default: module.ImprovedDashboard })));
const EnhancedDraggableDashboard = lazy(() => import('../components/dashboard/EnhancedDraggableDashboard'));


const Dashboard = memo(function Dashboard() {
  const { accounts, hasTestData, clearAllData } = useApp();
  const { firstName, setFirstName, setCurrency } = usePreferences();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [useDraggableDashboard, setUseDraggableDashboard] = useState(() => {
    // Check if user prefers draggable dashboard
    return localStorage.getItem('preferDraggableDashboard') === 'true';
  });
  
  // Check Supabase connection and migration status
  useEffect(() => {
    const checkSupabase = async () => {
      if (supabase && user) {
        try {
          // Simple test query to check connection
          const { error } = await supabase
            .from('users')
            .select('id')
            .limit(1);
          
          setSupabaseConnected(!error);
          if (!error) {
            logger.info('Supabase connected successfully');
            
            // Silent auto-migration - no user interaction needed
            // Migration happens automatically in AppContextSupabase
          } else {
            logger.warn('⚠️ Supabase connection issue:', error.message);
          }
        } catch (err) {
          logger.error('❌ Supabase connection failed:', err);
          setSupabaseConnected(false);
        }
      } else {
        setSupabaseConnected(false);
      }
    };
    
    checkSupabase();
  }, [user, accounts.length, showTestDataWarning, showOnboarding]);
  
  // Check for test data on component mount
  useEffect(() => {
    if (hasTestData) {
      const warningDismissed = localStorage.getItem('testDataWarningDismissed');
      if (warningDismissed !== 'true') {
        setShowTestDataWarning(true);
      }
    }
  }, [hasTestData, accounts.length]);

  // Check if onboarding should be shown
  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('onboardingCompleted');
    if (!onboardingCompleted && !firstName && !showTestDataWarning) {
      setShowOnboarding(true);
    }
  }, [firstName, showTestDataWarning]);

  // Handle onboarding completion
  const handleOnboardingComplete = (name: string, currency: string) => {
    setFirstName(name);
    setCurrency(currency);
    localStorage.setItem('onboardingCompleted', 'true');
    setShowOnboarding(false);
  };

  // Handle test data warning close
  const handleTestDataWarningClose = () => {
    setShowTestDataWarning(false);
    // Check if we should show onboarding after warning closes
    const onboardingCompleted = localStorage.getItem('onboardingCompleted');
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
            localStorage.setItem('preferDraggableDashboard', String(newValue));
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
