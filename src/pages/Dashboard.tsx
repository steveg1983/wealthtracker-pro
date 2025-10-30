import { useState, useEffect, lazy, Suspense } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { usePreferences } from '../contexts/PreferencesContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PageWrapper from '../components/PageWrapper';
import { SkeletonCard } from '../components/loading/Skeleton';
import LazyErrorBoundary from '../components/LazyErrorBoundary';

// Lazy load only modals and heavy features for better performance
const TestDataWarningModal = lazy(() => import('../components/TestDataWarningModal'));
const OnboardingModal = lazy(() => import('../components/OnboardingModal'));
const ImprovedDashboard = lazy(() => import('../components/dashboard/ImprovedDashboard').then(module => ({ default: module.ImprovedDashboard })));


export default function Dashboard() {
  const { accounts, hasTestData, clearAllData } = useApp();
  const { firstName, setFirstName, setCurrency } = usePreferences();
  const { user } = useAuth();
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [showTestDataWarning, setShowTestDataWarning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Check Supabase connection and migration status
  useEffect(() => {
    const checkSupabase = async () => {
      if (supabase && user) {
        try {
          // Simple test query to check connection
          const { error } = await supabase
            .from('user_profiles')
            .select('id')
            .limit(1);
          
          setSupabaseConnected(!error);
          if (!error) {
            // Silent auto-migration - no user interaction needed
            // Migration happens automatically in AppContextSupabase
          } else {
            // Supabase connection issue - handled silently
          }
        } catch (err) {
          // Supabase connection failed - handled silently
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
    <PageWrapper title="Dashboard">
      {/* Render the consolidated dashboard */}
      <LazyErrorBoundary componentName="Dashboard">
        <Suspense fallback={<SkeletonCard className="h-96" />}>
          <ImprovedDashboard />
        </Suspense>
      </LazyErrorBoundary>

      {/* Test Data Warning Modal */}
      <LazyErrorBoundary componentName="Test Data Warning">
        <Suspense fallback={null}>
          <TestDataWarningModal
            isOpen={showTestDataWarning}
            onClose={handleTestDataWarningClose}
            onClearData={() => {
              clearAllData();
              handleTestDataWarningClose();
            }}
          />
        </Suspense>
      </LazyErrorBoundary>

      {/* Onboarding Modal */}
      <LazyErrorBoundary componentName="Onboarding">
        <Suspense fallback={null}>
          <OnboardingModal
            isOpen={showOnboarding}
            onComplete={handleOnboardingComplete}
          />
        </Suspense>
      </LazyErrorBoundary>
    </PageWrapper>
  );
}