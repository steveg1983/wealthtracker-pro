import { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { SentryErrorBoundary } from './lib/sentry';
import { ErrorFallback } from './components/ErrorFallback';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { AppProvider } from './contexts/AppContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './design-system';
import { ReduxMigrationWrapper } from './components/ReduxMigrationWrapper';
import Layout from './components/Layout';
import PageLoader from './components/PageLoader';
import { merchantLogoService } from './services/merchantLogoService';
import { performanceService } from './services/performanceService';
import { lazyWithPreload, preloadWhenIdle } from './utils/lazyWithPreload';

// Lazy load all pages for code splitting with preload support
const Welcome = lazyWithPreload(() => import('./pages/Welcome'));
const Dashboard = lazyWithPreload(() => import('./pages/Dashboard'));
const Accounts = lazyWithPreload(() => import('./pages/Accounts'));
const Transactions = lazyWithPreload(() => import('./pages/Transactions'));
const TransactionsComparison = lazyWithPreload(() => import('./pages/TransactionsComparison'));
const Reconciliation = lazyWithPreload(() => import('./pages/Reconciliation'));
const Investments = lazyWithPreload(() => import('./pages/Investments'));
const Budget = lazyWithPreload(() => import('./pages/Budget'));
const Goals = lazyWithPreload(() => import('./pages/Goals'));
const Analytics = lazyWithPreload(() => import('./pages/Analytics'));
const AdvancedAnalytics = lazyWithPreload(() => import('./pages/AdvancedAnalytics'));
const TaxPlanning = lazyWithPreload(() => import('./pages/TaxPlanning'));
const SettingsPage = lazyWithPreload(() => import('./pages/Settings'));
const AppSettings = lazyWithPreload(() => import('./pages/settings/AppSettings'));
const DataManagement = lazyWithPreload(() => import('./pages/settings/DataManagement'));
const Categories = lazyWithPreload(() => import('./pages/settings/Categories'));
const Tags = lazyWithPreload(() => import('./pages/settings/Tags'));
const SecuritySettings = lazyWithPreload(() => import('./pages/settings/SecuritySettings'));
const AuditLogs = lazyWithPreload(() => import('./pages/settings/AuditLogs'));
const AccountTransactions = lazyWithPreload(() => import('./pages/AccountTransactions'));
const FinancialSummaries = lazyWithPreload(() => import('./pages/FinancialSummaries'));
const EnhancedInvestments = lazyWithPreload(() => import('./pages/EnhancedInvestments'));
const HouseholdManagement = lazyWithPreload(() => import('./pages/HouseholdManagement'));
const MobileFeatures = lazyWithPreload(() => import('./pages/MobileFeatures'));
const BusinessFeatures = lazyWithPreload(() => import('./pages/BusinessFeatures'));
const FinancialPlanning = lazyWithPreload(() => import('./pages/FinancialPlanning'));
const DataIntelligence = lazyWithPreload(() => import('./pages/DataIntelligence'));
const ExportManager = lazyWithPreload(() => import('./pages/ExportManager'));
const EnhancedImport = lazyWithPreload(() => import('./pages/EnhancedImport'));
const Documents = lazyWithPreload(() => import('./pages/Documents'));
const OCRTest = lazyWithPreload(() => import('./components/OCRTest'));
const OpenBanking = lazyWithPreload(() => import('./pages/OpenBanking'));
const Performance = lazyWithPreload(() => import('./pages/Performance'));

function App(): React.JSX.Element {
  useEffect(() => {
    // Preload common merchant logos in the background
    merchantLogoService.preloadCommonLogos();
    
    // Initialize performance monitoring
    performanceService.init();
    
    // Preload commonly accessed routes when browser is idle
    preloadWhenIdle(Dashboard);
    preloadWhenIdle(Transactions);
    preloadWhenIdle(Accounts);
    preloadWhenIdle(Budget);
  }, []);

  return (
    <ErrorBoundary>
      <SentryErrorBoundary fallback={(errorData) => <ErrorFallback error={errorData.error as Error} resetError={errorData.resetError} />} showDialog>
        <PreferencesProvider>
          <ThemeProvider>
            <AppProvider>
              <NotificationProvider>
                <LayoutProvider>
                  <ReduxMigrationWrapper>
                  <Router>
                    <Routes>
                      <Route path="/" element={<Layout />}>
                        <Route index element={
                          <Suspense fallback={<PageLoader />}>
                            <Welcome />
                          </Suspense>
                        } />
                  <Route path="dashboard" element={
                    <Suspense fallback={<PageLoader />}>
                      <Dashboard />
                    </Suspense>
                  } />
                  <Route path="accounts" element={
                    <Suspense fallback={<PageLoader />}>
                      <Accounts />
                    </Suspense>
                  } />
                  <Route path="accounts/:accountId" element={
                    <Suspense fallback={<PageLoader />}>
                      <AccountTransactions />
                    </Suspense>
                  } />
                  <Route path="transactions" element={
                    <Suspense fallback={<PageLoader />}>
                      <Transactions />
                    </Suspense>
                  } />
                  <Route path="transactions-comparison" element={
                    <Suspense fallback={<PageLoader />}>
                      <TransactionsComparison />
                    </Suspense>
                  } />
                  <Route path="reconciliation" element={
                    <Suspense fallback={<PageLoader />}>
                      <Reconciliation />
                    </Suspense>
                  } />
                  <Route path="investments" element={
                    <Suspense fallback={<PageLoader />}>
                      <Investments />
                    </Suspense>
                  } />
                  <Route path="enhanced-investments" element={
                    <Suspense fallback={<PageLoader />}>
                      <EnhancedInvestments />
                    </Suspense>
                  } />
                  <Route path="budget" element={
                    <Suspense fallback={<PageLoader />}>
                      <Budget />
                    </Suspense>
                  } />
                  <Route path="goals" element={
                    <Suspense fallback={<PageLoader />}>
                      <Goals />
                    </Suspense>
                  } />
                  <Route path="analytics" element={
                    <Suspense fallback={<PageLoader />}>
                      <Analytics />
                    </Suspense>
                  } />
                  <Route path="ai-analytics" element={
                    <Suspense fallback={<PageLoader />}>
                      <AdvancedAnalytics />
                    </Suspense>
                  } />
                  <Route path="tax-planning" element={
                    <Suspense fallback={<PageLoader />}>
                      <TaxPlanning />
                    </Suspense>
                  } />
                  <Route path="summaries" element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialSummaries />
                    </Suspense>
                  } />
                  <Route path="household" element={
                    <Suspense fallback={<PageLoader />}>
                      <HouseholdManagement />
                    </Suspense>
                  } />
                  <Route path="mobile-features" element={
                    <Suspense fallback={<PageLoader />}>
                      <MobileFeatures />
                    </Suspense>
                  } />
                  <Route path="business-features" element={
                    <Suspense fallback={<PageLoader />}>
                      <BusinessFeatures />
                    </Suspense>
                  } />
                  <Route path="financial-planning" element={
                    <Suspense fallback={<PageLoader />}>
                      <FinancialPlanning />
                    </Suspense>
                  } />
                  <Route path="data-intelligence" element={
                    <Suspense fallback={<PageLoader />}>
                      <DataIntelligence />
                    </Suspense>
                  } />
                  <Route path="export-manager" element={
                    <Suspense fallback={<PageLoader />}>
                      <ExportManager />
                    </Suspense>
                  } />
                  <Route path="enhanced-import" element={
                    <Suspense fallback={<PageLoader />}>
                      <EnhancedImport />
                    </Suspense>
                  } />
                  <Route path="documents" element={
                    <Suspense fallback={<PageLoader />}>
                      <Documents />
                    </Suspense>
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
                    <Route path="security" element={
                      <Suspense fallback={<PageLoader />}>
                        <SecuritySettings />
                      </Suspense>
                    } />
                    <Route path="security/audit-logs" element={
                      <Suspense fallback={<PageLoader />}>
                        <AuditLogs />
                      </Suspense>
                    } />
                  </Route>
                        <Route path="forecasting" element={<Navigate to="/budget" replace />} />
                      </Route>
                    </Routes>
                  </Router>
                  </ReduxMigrationWrapper>
                </LayoutProvider>
          </NotificationProvider>
          </AppProvider>
        </ThemeProvider>
      </PreferencesProvider>
      </SentryErrorBoundary>
    </ErrorBoundary>
  );
}

export default App;