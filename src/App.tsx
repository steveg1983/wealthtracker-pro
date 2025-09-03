import { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { SentryErrorBoundary } from './lib/sentry';
import { ErrorFallback } from './components/ErrorFallback';
import { CombinedProvider } from './contexts/CombinedProvider';
// Use Supabase-enabled AppContext if configured
import { AppProvider } from './contexts/AppContextSupabase';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './design-system';
// ReduxMigrationWrapper removed - app now "just works" without migration prompts
import { SupabaseDataLoader } from './components/SupabaseDataLoader';
import { AuthProvider } from './contexts/AuthContext';
// import { RealtimeSyncProvider } from './contexts/RealtimeSyncProvider'; // Temporarily disabled
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { ToastProvider } from './contexts/ToastContext';
import { ActivityLoggerProvider } from './components/ActivityLoggerProvider';
import LayoutNew from './components/LayoutNew';
import PageLoader from './components/PageLoader';
import { merchantLogoService } from './services/merchantLogoService';
import { performanceService } from './services/performanceService';
import { automaticBackupService } from './services/automaticBackupService';
import { lazyWithPreload, preloadWhenIdle } from './utils/lazyWithPreload';
import { initSafariCompat } from './utils/safariCompat';
import { initClerkSafariCompat } from './utils/clerkSafarifix';
import DiagnosticReport from './DiagnosticReport';
import { ProtectedSuspense } from './components/auth/ProtectedSuspense';
import RealtimeSyncTest from './components/RealtimeSyncTest';
import SafariWarning from './components/SafariWarning';
import { isDemoMode, initializeDemoData } from './utils/demoData';
import { DebugErrorBoundary } from './components/DebugErrorBoundary';
import { logger } from './services/loggingService';

// Lazy load all pages for code splitting with preload support
// Using webpack magic comments for better chunk naming and preloading hints
const Login = lazyWithPreload(() => import(/* webpackChunkName: "login" */ './pages/Login'));
const Welcome = lazyWithPreload(() => import(/* webpackChunkName: "welcome" */ './pages/Welcome'));
const Dashboard = lazyWithPreload(() => import(/* webpackChunkName: "dashboard", webpackPreload: true */ './pages/Dashboard'));
const DashboardV2 = lazyWithPreload(() => import(/* webpackChunkName: "dashboard-v2", webpackPreload: true */ './pages/DashboardV2'));
const Accounts = lazyWithPreload(() => import(/* webpackChunkName: "accounts", webpackPreload: true */ './pages/Accounts'));
const Transactions = lazyWithPreload(() => import(/* webpackChunkName: "transactions", webpackPreload: true */ './pages/Transactions'));
const TransactionsComparison = lazyWithPreload(() => import(/* webpackChunkName: "transactions-comparison" */ './pages/TransactionsComparison'));
const Reconciliation = lazyWithPreload(() => import(/* webpackChunkName: "reconciliation" */ './pages/Reconciliation'));
const Investments = lazyWithPreload(() => import(/* webpackChunkName: "investments" */ './pages/Investments'));
const Budget = lazyWithPreload(() => import(/* webpackChunkName: "budget", webpackPreload: true */ './pages/Budget'));
const Goals = lazyWithPreload(() => import(/* webpackChunkName: "goals" */ './pages/Goals'));
const Analytics = lazyWithPreload(() => import(/* webpackChunkName: "analytics" */ './pages/Analytics'));
const AdvancedAnalytics = lazyWithPreload(() => import(/* webpackChunkName: "advanced-analytics" */ './pages/AdvancedAnalytics'));
const AIFeatures = lazyWithPreload(() => import(/* webpackChunkName: "ai-features" */ './pages/AIFeatures'));
const CustomReports = lazyWithPreload(() => import(/* webpackChunkName: "custom-reports" */ './pages/CustomReports'));
const SettingsPage = lazyWithPreload(() => import(/* webpackChunkName: "settings" */ './pages/Settings'));
const AppSettings = lazyWithPreload(() => import(/* webpackChunkName: "app-settings" */ './pages/settings/AppSettings'));
const DataManagement = lazyWithPreload(() => import(/* webpackChunkName: "data-management" */ './pages/settings/DataManagement'));
const Categories = lazyWithPreload(() => import(/* webpackChunkName: "categories" */ './pages/settings/Categories'));
const Tags = lazyWithPreload(() => import(/* webpackChunkName: "tags" */ './pages/settings/Tags'));
const DeletedAccounts = lazyWithPreload(() => import(/* webpackChunkName: "deleted-accounts" */ './pages/settings/DeletedAccounts'));
const SecuritySettings = lazyWithPreload(() => import(/* webpackChunkName: "security-settings" */ './pages/settings/SecuritySettings'));
const AuditLogs = lazyWithPreload(() => import(/* webpackChunkName: "audit-logs" */ './pages/settings/AuditLogs'));
const Notifications = lazyWithPreload(() => import(/* webpackChunkName: "notifications" */ './pages/settings/Notifications'));
const AccessibilitySettings = lazyWithPreload(() => import(/* webpackChunkName: "accessibility-settings" */ './pages/settings/AccessibilitySettings'));
const AccessibilityDashboard = lazyWithPreload(() => import(/* webpackChunkName: "accessibility-dashboard" */ './components/AccessibilityDashboard'));
const AccountTransactions = lazyWithPreload(() => import(/* webpackChunkName: "account-transactions" */ './pages/AccountTransactions'));
const FinancialSummaries = lazyWithPreload(() => import(/* webpackChunkName: "financial-summaries" */ './pages/FinancialSummaries'));
const EnhancedInvestments = lazyWithPreload(() => import(/* webpackChunkName: "enhanced-investments" */ './pages/EnhancedInvestments'));
const MobileFeatures = lazyWithPreload(() => import(/* webpackChunkName: "mobile-features" */ './pages/MobileFeatures'));
const FinancialPlanning = lazyWithPreload(() => import(/* webpackChunkName: "financial-planning" */ './pages/FinancialPlanning'));
const DataIntelligence = lazyWithPreload(() => import(/* webpackChunkName: "data-intelligence" */ './pages/DataIntelligence'));
const ExportManager = lazyWithPreload(() => import(/* webpackChunkName: "export-manager" */ './pages/ExportManager'));
const Advanced = lazyWithPreload(() => import(/* webpackChunkName: "advanced" */ './pages/Advanced'));
const EnhancedImport = lazyWithPreload(() => import(/* webpackChunkName: "enhanced-import" */ './pages/EnhancedImport'));
const Documents = lazyWithPreload(() => import(/* webpackChunkName: "documents" */ './pages/Documents'));
const OCRTest = lazyWithPreload(() => import(/* webpackChunkName: "ocr-test" */ './components/OCRTest'));
const OpenBanking = lazyWithPreload(() => import(/* webpackChunkName: "open-banking" */ './pages/OpenBanking'));
const BankConnections = lazyWithPreload(() => import(/* webpackChunkName: "bank-connections" */ './components/BankConnections'));
const Performance = lazyWithPreload(() => import(/* webpackChunkName: "performance" */ './pages/Performance'));
const Subscription = lazyWithPreload(() => import(/* webpackChunkName: "subscription" */ './pages/Subscription'));
const TransferCenter = lazyWithPreload(() => import(/* webpackChunkName: "transfer-center" */ './pages/TransferCenter'));

function App(): React.JSX.Element {
  useEffect(() => {
    // Initialize Safari compatibility fixes
    const initApp = async () => {
      // Check Safari compatibility first
      const safariCompat = await initSafariCompat();
      if (safariCompat.safari) {
        logger.info('Safari compatibility mode:', safariCompat);
        
        // Apply Clerk-specific Safari fixes
        const clerkCompat = await initClerkSafariCompat();
        logger.info('Clerk Safari compatibility:', clerkCompat);
      }
    };
    
    initApp();
    
    // Initialize demo mode if requested
    if (isDemoMode()) {
      initializeDemoData();
      logger.info('🎭 Demo mode activated - Using sample data for UI/UX testing');
    }
    
    // Simplified storage check - don't auto-clear
    logger.info('App starting with clean storage');
    
    // Preload common merchant logos in the background
    merchantLogoService.preloadCommonLogos();
    
    // Initialize performance monitoring
    performanceService.init();
    
    // Initialize automatic backups
    automaticBackupService.initializeBackups();
    
    // Handle service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'perform-backup') {
          automaticBackupService.performBackup();
        }
      });
    }
    
    // Preload commonly accessed routes when browser is idle
    preloadWhenIdle(Dashboard);
    preloadWhenIdle(Transactions);
    preloadWhenIdle(Accounts);
    preloadWhenIdle(Budget);
  }, []);

  return (
    <DebugErrorBoundary>
      <ErrorBoundary>
        <SentryErrorBoundary fallback={(errorData) => <ErrorFallback error={errorData.error as Error} resetError={errorData.resetError} />} showDialog>
          <CombinedProvider>
          <ThemeProvider>
            <AppProvider>
              <AuthProvider>
                <SubscriptionProvider>
                  <ToastProvider>
                    <NotificationProvider>
                      <SupabaseDataLoader>
                            <ActivityLoggerProvider>
                              <Router>
                                <SafariWarning />
                        <Routes>
                        {/* Login route outside of Layout */}
                        <Route path="/login" element={
                          <Suspense fallback={<PageLoader />}>
                            <Login />
                          </Suspense>
                        } />
                        
                        {/* Main app routes */}
                        <Route path="/" element={<LayoutNew />}>
                          {/* Public welcome page */}
                          <Route index element={
                            <Suspense fallback={<PageLoader />}>
                              <Welcome />
                            </Suspense>
                          } />
                          
                          {/* Protected routes - all financial data pages */}
                          <Route path="dashboard" element={
                            <ProtectedSuspense>
                              <DashboardV2 />
                            </ProtectedSuspense>
                          } />
                          <Route path="accounts" element={
                            <ProtectedSuspense>
                              <Accounts />
                            </ProtectedSuspense>
                          } />
                          <Route path="accounts/:accountId" element={
                            <ProtectedSuspense>
                              <AccountTransactions />
                            </ProtectedSuspense>
                          } />
                          <Route path="transfers" element={
                            <ProtectedSuspense>
                              <TransferCenter />
                            </ProtectedSuspense>
                          } />
                          <Route path="transactions" element={
                            <ProtectedSuspense>
                              <Transactions />
                            </ProtectedSuspense>
                          } />
                          <Route path="transactions-comparison" element={
                            <ProtectedSuspense>
                              <TransactionsComparison />
                            </ProtectedSuspense>
                          } />
                          <Route path="reconciliation" element={
                            <ProtectedSuspense>
                              <Reconciliation />
                            </ProtectedSuspense>
                          } />
                          <Route path="investments" element={
                            <ProtectedSuspense>
                              <Investments />
                            </ProtectedSuspense>
                          } />
                          <Route path="enhanced-investments" element={
                            <ProtectedSuspense requirePremium={true}>
                              <EnhancedInvestments />
                            </ProtectedSuspense>
                          } />
                          <Route path="budget" element={
                            <ProtectedSuspense>
                              <Budget />
                            </ProtectedSuspense>
                          } />
                          <Route path="goals" element={
                            <ProtectedSuspense>
                              <Goals />
                            </ProtectedSuspense>
                          } />
                          <Route path="analytics" element={
                            <ProtectedSuspense>
                              <Analytics />
                            </ProtectedSuspense>
                          } />
                          
                          {/* Premium features */}
                          <Route path="ai-analytics" element={
                            <ProtectedSuspense requirePremium={true}>
                              <AdvancedAnalytics />
                            </ProtectedSuspense>
                          } />
                          <Route path="ai-features" element={
                            <ProtectedSuspense requirePremium={true}>
                              <AIFeatures />
                            </ProtectedSuspense>
                          } />
                          <Route path="custom-reports" element={
                            <ProtectedSuspense requirePremium={true}>
                              <CustomReports />
                            </ProtectedSuspense>
                          } />
                          <Route path="summaries" element={
                            <ProtectedSuspense>
                              <FinancialSummaries />
                            </ProtectedSuspense>
                          } />
                          <Route path="mobile-features" element={
                            <ProtectedSuspense>
                              <MobileFeatures />
                            </ProtectedSuspense>
                          } />
                          <Route path="financial-planning" element={
                            <ProtectedSuspense requirePremium={true}>
                              <FinancialPlanning />
                            </ProtectedSuspense>
                          } />
                          <Route path="data-intelligence" element={
                            <ProtectedSuspense requirePremium={true}>
                              <DataIntelligence />
                            </ProtectedSuspense>
                          } />
                          <Route path="export-manager" element={
                            <ProtectedSuspense>
                              <ExportManager />
                            </ProtectedSuspense>
                          } />
                          <Route path="enhanced-import" element={
                            <ProtectedSuspense>
                              <EnhancedImport />
                            </ProtectedSuspense>
                          } />
                          <Route path="documents" element={
                            <ProtectedSuspense>
                              <Documents />
                            </ProtectedSuspense>
                          } />
                  <Route path="ocr-test" element={
                    <Suspense fallback={<PageLoader />}>
                      <OCRTest />
                    </Suspense>
                  } />
                  <Route path="open-banking" element={
                    <Suspense fallback={<PageLoader />}>
                      <OpenBanking />
                    </Suspense>
                  } />
                  <Route path="performance" element={
                    <Suspense fallback={<PageLoader />}>
                      <Performance />
                    </Suspense>
                  } />
                  <Route path="subscription" element={
                    <Suspense fallback={<PageLoader />}>
                      <Subscription />
                    </Suspense>
                  } />
                  <Route path="advanced" element={
                    <Suspense fallback={<PageLoader />}>
                      <Advanced />
                    </Suspense>
                  } />
                  <Route path="settings">
                    <Route index element={
                      <Suspense fallback={<PageLoader />}>
                        <SettingsPage />
                      </Suspense>
                    } />
                    <Route path="app" element={
                      <Suspense fallback={<PageLoader />}>
                        <AppSettings />
                      </Suspense>
                    } />
                    <Route path="data" element={
                      <Suspense fallback={<PageLoader />}>
                        <DataManagement />
                      </Suspense>
                    } />
                    <Route path="categories" element={
                      <Suspense fallback={<PageLoader />}>
                        <Categories />
                      </Suspense>
                    } />
                    <Route path="tags" element={
                      <Suspense fallback={<PageLoader />}>
                        <Tags />
                      </Suspense>
                    } />
                    <Route path="bank-connections" element={
                      <Suspense fallback={<PageLoader />}>
                        <BankConnections />
                      </Suspense>
                    } />
                    <Route path="notifications" element={
                      <Suspense fallback={<PageLoader />}>
                        <Notifications />
                      </Suspense>
                    } />
                    <Route path="accessibility" element={
                      <Suspense fallback={<PageLoader />}>
                        <AccessibilitySettings />
                      </Suspense>
                    } />
                    <Route path="deleted-accounts" element={
                      <Suspense fallback={<PageLoader />}>
                        <DeletedAccounts />
                      </Suspense>
                    } />
                    <Route path="security" element={
                      <Suspense fallback={<PageLoader />}>
                        <SecuritySettings />
                      </Suspense>
                    } />
                    <Route path="subscription" element={
                      <Suspense fallback={<PageLoader />}>
                        <Subscription />
                      </Suspense>
                    } />
                    <Route path="security/audit-logs" element={
                      <Suspense fallback={<PageLoader />}>
                        <AuditLogs />
                      </Suspense>
                    } />
                    <Route path="accessibility" element={
                      <Suspense fallback={<PageLoader />}>
                        <AccessibilityDashboard />
                      </Suspense>
                    } />
                  </Route>
                  <Route path="diagnostics" element={
                    <Suspense fallback={<PageLoader />}>
                      <DiagnosticReport />
                    </Suspense>
                  } />
                  <Route path="realtime-test" element={
                    <Suspense fallback={<PageLoader />}>
                      <RealtimeSyncTest />
                    </Suspense>
                  } />
                        <Route path="forecasting" element={<Navigate to="/budget" replace />} />
                      </Route>
                        </Routes>
                              </Router>
                            </ActivityLoggerProvider>
                        </SupabaseDataLoader>
                    </NotificationProvider>
                  </ToastProvider>
                </SubscriptionProvider>
              </AuthProvider>
            </AppProvider>
          </ThemeProvider>
        </CombinedProvider>
      </SentryErrorBoundary>
    </ErrorBoundary>
    </DebugErrorBoundary>
  );
}

export default App;
