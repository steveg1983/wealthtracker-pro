import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNavBar from './navigation/TopNavBar';
import { PageTransition, NavigationProgress } from './layout/SimplePageTransition';
import { Breadcrumbs } from './layout/Breadcrumbs';
import { EnhancedSkipLinks, FocusIndicator, RouteAnnouncer } from './layout/AccessibilityImprovements';
import OfflineIndicator from './OfflineIndicator';
import { SyncConflictResolver } from './SyncConflictResolver';
import PWAInstallPrompt from './PWAInstallPrompt';
import ServiceWorkerUpdateNotification from './ServiceWorkerUpdateNotification';
import { useServiceWorker } from '../hooks/useServiceWorker';
import { OfflineIndicator as PWAOfflineIndicator } from './pwa/OfflineIndicator';
import { MobilePullToRefreshWrapper } from './MobilePullToRefreshWrapper';
import { QuickAddOfflineButton } from './pwa/QuickAddOfflineButton';
import { EnhancedConflictResolutionModal } from './pwa/EnhancedConflictResolutionModal';
import { useConflictResolution } from '../hooks/useConflictResolution';
import GlobalSearch from './GlobalSearch';
import { useGlobalSearchDialog } from '../hooks/useGlobalSearchDialog';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import { useKeyboardShortcutsHelp } from '../hooks/useKeyboardShortcutsHelp';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import KeyboardSequenceIndicator from './KeyboardSequenceIndicator';
import MobileBottomNav from './MobileBottomNav';
import ErrorBoundary from './ErrorBoundary';
import { FloatingActionButton } from './FloatingActionButton';
import DemoModeIndicator from './DemoModeIndicator';
import OnboardingGuide from './onboarding/OnboardingGuide';
import PageTips from './help/PageTips';
import type { ConflictAnalysis } from '../services/conflictResolutionService';
import type { EntityType } from '../types/sync-types';
import { logger } from '../services/loggingService';

export default function LayoutNew(): React.JSX.Element {
  const location = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPageTips, setShowPageTips] = useState(false);
  
  const { registration, updateAvailable } = useServiceWorker();
  const {
    currentConflict,
    currentAnalysis,
    isModalOpen,
    resolveConflict,
    dismissConflict,
    queueConflict,
    showConflictModal
  } = useConflictResolution();
  const { isOpen: isSearchOpen, openSearch, closeSearch } = useGlobalSearchDialog();
  const { isOpen: isHelpOpen, openHelp, closeHelp } = useKeyboardShortcutsHelp();
  const { activeSequence } = useGlobalKeyboardShortcuts(openHelp);

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

  // Set up auxiliary keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === '?') {
        event.preventDefault();
        openHelp();
        return;
      }

      if (event.altKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        window.location.reload();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSearch, openHelp]);

  const handleRefresh = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    window.location.reload();
  };

  // Close mobile menu on route change
  useEffect(() => {
    // Close mobile-specific overlays on navigation change when implemented
  }, [location.pathname]);

  useEffect(() => {
    const isEntityType = (value: unknown): value is EntityType => {
      return typeof value === 'string' && (
        value === 'transaction' ||
        value === 'account' ||
        value === 'budget' ||
        value === 'goal' ||
        value === 'category'
      );
    };

    const parseConflictDetail = (value: unknown) => {
      if (!value || typeof value !== 'object') {
        return null;
      }

      const candidate = value as Record<string, unknown>;
      if (!isEntityType(candidate.entity)) {
        return null;
      }

      const payload: Record<string, unknown> = {
        entity: candidate.entity,
        clientData: candidate.clientData,
        serverData: candidate.serverData
      };

      if (typeof candidate.id === 'string' && candidate.id.length > 0) {
        payload.id = candidate.id;
      }

      if (candidate.clientTimestamp !== undefined) {
        payload.clientTimestamp = candidate.clientTimestamp;
      }

      if (candidate.serverTimestamp !== undefined) {
        payload.serverTimestamp = candidate.serverTimestamp;
      }

      if (candidate.timestamp !== undefined) {
        payload.timestamp = candidate.timestamp;
      }

      return payload;
    };

    const handleOpenConflictResolver = (event: Event) => {
      const { conflict, analysis } = (event as CustomEvent<{ conflict?: unknown; analysis?: ConflictAnalysis | null }>).detail ?? {};

      const parsedConflict = parseConflictDetail(conflict);

      if (parsedConflict) {
        queueConflict(parsedConflict as Parameters<typeof queueConflict>[0], analysis ?? null);
      } else if (conflict) {
        logger.warn('LayoutNew: Ignoring conflict resolver event with invalid payload');
      } else {
        showConflictModal();
      }
    };

    window.addEventListener('open-conflict-resolver', handleOpenConflictResolver);
    return () => window.removeEventListener('open-conflict-resolver', handleOpenConflictResolver);
  }, [queueConflict, showConflictModal]);

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-gray-900">
      <EnhancedSkipLinks />
      <FocusIndicator />
      <RouteAnnouncer />
      
      {/* Top Navigation Bar */}
      <TopNavBar />
      
      {/* Progress Bar */}
      <NavigationProgress />
      
      {/* Main Content Area - With consistent margins and padding for fixed header */}
      <div className="w-full min-h-screen bg-blue-50 dark:bg-gray-900 pt-16">
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
      {updateAvailable && <ServiceWorkerUpdateNotification registration={registration} />}
      {currentConflict && (
        <EnhancedConflictResolutionModal
          isOpen={isModalOpen}
          onClose={dismissConflict}
          conflict={currentConflict}
          {...(currentAnalysis ? { analysis: currentAnalysis } : {})}
          onResolve={resolveConflict}
        />
      )}
      <SyncConflictResolver />
      <KeyboardSequenceIndicator activeSequence={activeSequence} />
      
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
