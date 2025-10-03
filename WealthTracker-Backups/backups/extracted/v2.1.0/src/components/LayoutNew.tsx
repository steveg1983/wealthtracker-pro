import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNavBar from './navigation/TopNavBar';
import { PageTransition, NavigationProgress } from './layout/SimplePageTransition';
import { Breadcrumbs } from './layout/Breadcrumbs';
import { EnhancedSkipLinks, FocusIndicator, RouteAnnouncer } from './layout/AccessibilityImprovements';
import OfflineIndicator from './OfflineIndicator';
import { OfflineStatus } from './OfflineStatus';
import { SyncConflictResolver } from './SyncConflictResolver';
import PWAInstallPrompt from './PWAInstallPrompt';
import ServiceWorkerUpdateNotification from './ServiceWorkerUpdateNotification';
import { useServiceWorker } from '../hooks/useServiceWorker';
import { OfflineIndicator as PWAOfflineIndicator } from './pwa/OfflineIndicator';
import { MobilePullToRefreshWrapper } from './MobilePullToRefreshWrapper';
import { QuickAddOfflineButton } from './pwa/QuickAddOfflineButton';
import { EnhancedConflictResolutionModal } from './pwa/EnhancedConflictResolutionModal';
import { useConflictResolution } from '../hooks/useConflictResolution';
import GlobalSearch, { useGlobalSearchDialog } from './GlobalSearch';
import KeyboardShortcutsHelp, { useKeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import KeyboardSequenceIndicator from './KeyboardSequenceIndicator';
import MobileBottomNav from './MobileBottomNav';
import ErrorBoundary from './ErrorBoundary';
import { FloatingActionButton } from './FloatingActionButton';
import DemoModeIndicator from './DemoModeIndicator';
import OnboardingGuide from './onboarding/OnboardingGuide';
import PageTips from './help/PageTips';

export default function LayoutNew(): React.JSX.Element {
  const location = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPageTips, setShowPageTips] = useState(false);
  
  const { updateAvailable, skipWaiting } = useServiceWorker();
  const { conflicts = [], resolveConflict } = useConflictResolution();
  const { isDialogOpen: isSearchOpen, openDialog: openSearch, closeDialog: closeSearch } = useGlobalSearchDialog();
  const { isHelpOpen, openHelp, closeHelp } = useKeyboardShortcutsHelp();

  // Check if user is new and needs onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }

    // Check if page tips should be shown
    const showTips = localStorage.getItem('showPageTips');
    if (showTips === 'true') {
      setShowPageTips(true);
    }
  }, []);

  // Set up global keyboard shortcuts
  useGlobalKeyboardShortcuts({
    onSearch: openSearch,
    onHelp: openHelp,
    onRefresh: () => {
      setIsRefreshing(true);
      window.location.reload();
    }
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    window.location.reload();
  };

  // Close mobile menu on route change
  useEffect(() => {
    setShowMobileMenu(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-gray-900">
      <EnhancedSkipLinks />
      <FocusIndicator />
      <RouteAnnouncer />
      
      {/* Top Navigation Bar */}
      <TopNavBar />
      
      {/* Progress Bar */}
      <NavigationProgress />
      
      {/* Main Content Area - With consistent margins */}
      <div className="w-full min-h-screen bg-blue-50 dark:bg-gray-900">
        {/* Breadcrumbs with margins */}
        <div className="px-6 pt-1">
          <div className="bg-white/80 dark:bg-gray-800 rounded-lg px-3 py-0.5 mb-4 backdrop-blur-sm">
            <Breadcrumbs />
          </div>
        </div>
        
        {/* Page Content with consistent padding */}
        <main className="w-full px-6 pb-6">
          <PageTransition>
            <div className="w-full">
              <MobilePullToRefreshWrapper onRefresh={handleRefresh}>
                <ErrorBoundary>
                  <div className="relative">
                    <Outlet />
                    
                    {/* Page Tips Overlay */}
                    {showPageTips && (
                      <PageTips 
                        page={location.pathname}
                        onClose={() => {
                          setShowPageTips(false);
                          localStorage.setItem('showPageTips', 'false');
                        }}
                      />
                    )}
                  </div>
                </ErrorBoundary>
              </MobilePullToRefreshWrapper>
            </div>
          </PageTransition>
        </main>
      </div>
      
      {/* Status Indicators */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-40">
        <DemoModeIndicator />
        <OfflineIndicator />
        <PWAOfflineIndicator />
      </div>
      
      {/* Floating Action Button for Mobile */}
      <div className="lg:hidden">
        <FloatingActionButton />
      </div>
      
      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden">
        <MobileBottomNav />
      </div>
      
      {/* Modals and Overlays */}
      <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
      <KeyboardShortcutsHelp isOpen={isHelpOpen} onClose={closeHelp} />
      <PWAInstallPrompt />
      {updateAvailable && <ServiceWorkerUpdateNotification onUpdate={skipWaiting} />}
      {conflicts.length > 0 && (
        <EnhancedConflictResolutionModal
          conflicts={conflicts}
          onResolve={resolveConflict}
        />
      )}
      <SyncConflictResolver />
      <KeyboardSequenceIndicator />
      
      {/* Onboarding Guide for New Users */}
      {showOnboarding && (
        <OnboardingGuide 
          onComplete={() => {
            setShowOnboarding(false);
            localStorage.setItem('hasSeenOnboarding', 'true');
          }}
        />
      )}
      
      {/* Quick Add Button (always visible) */}
      <QuickAddOfflineButton />
    </div>
  );
}