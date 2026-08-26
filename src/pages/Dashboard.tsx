import { useState, useEffect, Suspense } from 'react';
import { lazyWithRecovery } from '../utils/lazyWithRecovery';
import { usePreferences } from '../contexts/PreferencesContext';
import PageWrapper from '../components/PageWrapper';
import { WholePoundsScope } from '../contexts/WholePoundsContext';
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
  const { firstName, setCurrency } = usePreferences();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Retired 2026-08-10: the Supabase "connection check".
  //
  // It was the last direct Postgres client in a React page, and it was not a
  // read at all — it selected one id out of `user_profiles`, put the result in
  // a state variable named `_supabaseConnected` that NOTHING read, and
  // re-rendered the dashboard to store it. It re-ran on every change of user,
  // account count and onboarding flag, so every account added fired another
  // query whose answer was discarded. Its own comment said the migration it was
  // watching for "happens automatically in AppContextSupabase", which is true:
  // the boot prepares categories and runs the id migration through the seam,
  // and it is the seam that reports a store it cannot reach.
  //
  // Nothing observable goes with it — an unread state variable has no screen —
  // so there is no capability to route this through. It is deleted rather than
  // ported, and with it go this page's imports of the database client, the auth
  // context and the app context, none of which it used for anything else.

  // Check if onboarding should be shown
  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('onboardingCompleted');
    if (!onboardingCompleted && !firstName) {
      setShowOnboarding(true);
    }
  }, [firstName]);

  // Handle onboarding completion
  const handleOnboardingComplete = (currency: string) => {
    setCurrency(currency);
    localStorage.setItem('onboardingCompleted', 'true');
    setShowOnboarding(false);
  };

  return (
    <PageWrapper title="Dashboard">
      {/* Render the consolidated dashboard — inside its whole-pounds scope,
          so every widget's useCurrencyDecimal follows the page's checkbox
          (owner, 19 Aug: page-specific decimal display). */}
      <WholePoundsScope page="dashboard">
        <LazyErrorBoundary componentName="Dashboard">
          <Suspense fallback={<SkeletonCard className="h-96" />}>
            <ImprovedDashboard />
          </Suspense>
        </LazyErrorBoundary>
      </WholePoundsScope>

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