import { useState, useEffect, Suspense } from 'react';
import { lazyWithRecovery } from '../utils/lazyWithRecovery';
import { useApp } from '../contexts/AppContextSupabase';
import { usePreferences } from '../contexts/PreferencesContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PageWrapper from '../components/PageWrapper';
import { SkeletonCard } from '../components/loading/Skeleton';
import LazyErrorBoundary from '../components/LazyErrorBoundary';
import PageTip from '../components/PageTip';

// Lazy load only modals and heavy features for better performance
//
// Retired 2026-08-07: TestDataWarningModal. It fired off a `hasTestData` flag
// that nothing could keep true to reality, and its "Clear & Start Fresh" button
// only emptied React state — on a cloud login every row came back on the next
// load, so the offer was one the app could not keep.
const OnboardingModal = lazyWithRecovery(() => import('../components/OnboardingModal'));
const ImprovedDashboard = lazyWithRecovery(() => import('../components/dashboard/ImprovedDashboard').then(module => ({ default: module.ImprovedDashboard })));


export default function Dashboard() {
  const { accounts } = useApp();
  const { firstName, setFirstName, setCurrency } = usePreferences();
  const { user } = useAuth();
  const [_supabaseConnected, setSupabaseConnected] = useState(false);
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
        } catch {
          // Supabase connection failed - handled silently
          setSupabaseConnected(false);
        }
      } else {
        setSupabaseConnected(false);
      }
    };
    
    checkSupabase();
  }, [user, accounts.length, showOnboarding]);

  // Check if onboarding should be shown
  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('onboardingCompleted');
    if (!onboardingCompleted && !firstName) {
      setShowOnboarding(true);
    }
  }, [firstName]);

  // Handle onboarding completion
  const handleOnboardingComplete = (name: string, currency: string) => {
    setFirstName(name);
    setCurrency(currency);
    localStorage.setItem('onboardingCompleted', 'true');
    setShowOnboarding(false);
  };

  return (
    <PageWrapper title="Dashboard">
      {/* Render the consolidated dashboard */}
      <LazyErrorBoundary componentName="Dashboard">
        <Suspense fallback={<SkeletonCard className="h-96" />}>
          <ImprovedDashboard />
        </Suspense>
      </LazyErrorBoundary>

      {/* id bumped from `dashboard-welcome`: the old copy promised a recent
          activity list that no longer exists, so anyone who dismissed it needs
          to see the corrected version once. */}
      <PageTip
        id="dashboard-welcome-2"
        title="What's on your dashboard"
        description="Net worth first, then income and expenses over whichever period you choose, the reports you pin here, your key accounts and how the budgets are going. Income, expenses and the account cards all open the transactions behind them."
      />

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