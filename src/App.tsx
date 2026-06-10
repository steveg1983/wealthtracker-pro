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
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { ToastProvider } from './contexts/ToastContext';
import { ActivityLoggerProvider } from './components/ActivityLoggerProvider';
import Layout from './components/Layout';
import PageLoader from './components/PageLoader';
import { merchantLogoService } from './services/merchantLogoService';
import { performanceService } from './services/performanceService';
import { automaticBackupService } from './services/automaticBackupService';
import { lazyWithPreload, preloadWhenIdle } from './utils/lazyWithPreload';
import { initSafariCompat } from './utils/safariCompat';
import { initClerkSafariCompat } from './utils/clerkSafarifix';
import { ProtectedSuspense } from './components/auth/ProtectedSuspense';
import SafariWarning from './components/SafariWarning';
import { isDemoMode, initializeDemoData } from './utils/demoData';
import { DebugErrorBoundary } from './components/DebugErrorBoundary';

// Lazy load all pages for code splitting with preload support
// Using webpack magic comments for better chunk naming and preloading hints
const Login = lazyWithPreload(() => import(/* webpackChunkName: "login" */ './pages/Login'));
const BankingCallback = lazyWithPreload(() => import(/* webpackChunkName: "banking-callback" */ './pages/BankingCallback'));
const Welcome = lazyWithPreload(() => import(/* webpackChunkName: "welcome" */ './pages/Welcome'));
const Dashboard = lazyWithPreload(() => import(/* webpackChunkName: "dashboard", webpackPreload: true */ './pages/Dashboard'));
const Accounts = lazyWithPreload(() => import(/* webpackChunkName: "accounts", webpackPreload: true */ './pages/Accounts'));
const Transactions = lazyWithPreload(() => import(/* webpackChunkName: "transactions", webpackPreload: true */ './pages/Transactions'));
const Reconciliation = lazyWithPreload(() => import(/* webpackChunkName: "reconciliation" */ './pages/Reconciliation'));
const Investments = lazyWithPreload(() => import(/* webpackChunkName: "investments" */ './pages/Investments'));
const Budget = lazyWithPreload(() => import(/* webpackChunkName: "budget", webpackPreload: true */ './pages/Budget'));
const Calendar = lazyWithPreload(() => import(/* webpackChunkName: "calendar" */ './pages/Calendar'));
const ReportsHub = lazyWithPreload(() => import(/* webpackChunkName: "reports-hub" */ './pages/ReportsHub'));
const Goals = lazyWithPreload(() => import(/* webpackChunkName: "goals" */ './pages/Goals'));
const Analytics = lazyWithPreload(() => import(/* webpackChunkName: "analytics" */ './pages/Analytics'));
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
const AccountTransactions = lazyWithPreload(() => import(/* webpackChunkName: "account-transactions" */ './pages/AccountTransactions'));
const FinancialSummaries = lazyWithPreload(() => import(/* webpackChunkName: "financial-summaries" */ './pages/FinancialSummaries'));
const EnhancedInvestments = lazyWithPreload(() => import(/* webpackChunkName: "enhanced-investments" */ './pages/EnhancedInvestments'));
const ExportManager = lazyWithPreload(() => import(/* webpackChunkName: "export-manager" */ './pages/ExportManager'));
const EnhancedImport = lazyWithPreload(() => import(/* webpackChunkName: "enhanced-import" */ './pages/EnhancedImport'));
const Documents = lazyWithPreload(() => import(/* webpackChunkName: "documents" */ './pages/Documents'));
const OpenBanking = lazyWithPreload(() => import(/* webpackChunkName: "open-banking" */ './pages/OpenBanking'));
const Subscription = lazyWithPreload(() => import(/* webpackChunkName: "subscription" */ './pages/Subscription'));

function App(): React.JSX.Element {
  useEffect(() => {
    // Initialize Safari compatibility fixes
    const initApp = async () => {
      // Check Safari compatibility first
      const safariCompat = await initSafariCompat();
      if (safariCompat.safari) {
        // Safari compatibility mode enabled

        // Apply Clerk-specific Safari fixes
        await initClerkSafariCompat();
        // Clerk Safari compatibility applied
      }
    };
    
    initApp();
    
    // Initialize demo mode if requested
    if (isDemoMode()) {
      initializeDemoData();
      // Demo mode activated - Using sample data for UI/UX testing
    }
    
    // Simplified storage check - don't auto-clear
    // App starting with clean storage

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
                        <Route path="/auth/callback" element={
                          <Suspense fallback={<PageLoader />}>
                            <BankingCallback />
                          </Suspense>
                        } />
                        
                        {/* Main app routes */}
                        <Route path="/" element={<Layout />}>
                          {/* Public welcome page */}
                          <Route index element={
                            <Suspense fallback={<PageLoader />}>
                              <Welcome />
                            </Suspense>
                          } />
                          
                          {/* Protected routes - all financial data pages */}
                          <Route path="dashboard" element={
                            <ProtectedSuspense>
                              <Dashboard />
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
                          <Route path="transactions" element={
                            <ProtectedSuspense>
                              <Transactions />
                            </ProtectedSuspense>
                          } />
                          <Route path="transactions-comparison" element={<Navigate to="/transactions" replace />} />
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
                          <Route path="calendar" element={
                            <ProtectedSuspense>
                              <Calendar />
                            </ProtectedSuspense>
                          } />
                          <Route path="reports" element={
                            <ProtectedSuspense>
                              <ReportsHub />
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
                          
                          {/* Reports sub-pages (loaded by ReportsHub) */}
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
                          {/* Redirects for consolidated/removed pages */}
                          <Route path="ai-analytics" element={<Navigate to="/reports" replace />} />
                          <Route path="ai-features" element={<Navigate to="/reports" replace />} />
                          <Route path="tax-planning" element={<Navigate to="/reports" replace />} />
                          <Route path="household" element={<Navigate to="/settings" replace />} />
                          <Route path="mobile-features" element={<Navigate to="/dashboard" replace />} />
                          <Route path="business-features" element={<Navigate to="/dashboard" replace />} />
                          <Route path="financial-planning" element={<Navigate to="/reports" replace />} />
                          <Route path="data-intelligence" element={<Navigate to="/reports" replace />} />
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
                  <Route path="open-banking" element={
                    <ProtectedSuspense>
                      <OpenBanking />
                    </ProtectedSuspense>
                  } />
                  <Route path="performance" element={<Navigate to="/dashboard" replace />} />
                  <Route path="subscription" element={
                    <ProtectedSuspense>
                      <Subscription />
                    </ProtectedSuspense>
                  } />
                  <Route path="advanced" element={<Navigate to="/dashboard" replace />} />
                  <Route path="settings">
                    <Route index element={
                      <ProtectedSuspense>
                        <SettingsPage />
                      </ProtectedSuspense>
                    } />
                    <Route path="app" element={
                      <ProtectedSuspense>
                        <AppSettings />
                      </ProtectedSuspense>
                    } />
                    <Route path="data" element={
                      <ProtectedSuspense>
                        <DataManagement />
                      </ProtectedSuspense>
                    } />
                    <Route path="categories" element={
                      <ProtectedSuspense>
                        <Categories />
                      </ProtectedSuspense>
                    } />
                    <Route path="tags" element={
                      <ProtectedSuspense>
                        <Tags />
                      </ProtectedSuspense>
                    } />
                    <Route path="notifications" element={
                      <ProtectedSuspense>
                        <Notifications />
                      </ProtectedSuspense>
                    } />
                    <Route path="accessibility" element={
                      <ProtectedSuspense>
                        <AccessibilitySettings />
                      </ProtectedSuspense>
                    } />
                    <Route path="deleted-accounts" element={
                      <ProtectedSuspense>
                        <DeletedAccounts />
                      </ProtectedSuspense>
                    } />
                    <Route path="security" element={
                      <ProtectedSuspense>
                        <SecuritySettings />
                      </ProtectedSuspense>
                    } />
                    <Route path="subscription" element={
                      <ProtectedSuspense>
                        <Subscription />
                      </ProtectedSuspense>
                    } />
                    <Route path="security/audit-logs" element={
                      <ProtectedSuspense>
                        <AuditLogs />
                      </ProtectedSuspense>
                    } />
                  </Route>
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
