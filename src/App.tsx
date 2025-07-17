import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { SentryErrorBoundary } from './lib/sentry';
import { ErrorFallback } from './components/ErrorFallback';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { AppProvider } from './contexts/AppContext';
import { LayoutProvider } from './contexts/LayoutContext';
import Layout from './components/Layout';
import PageLoader from './components/PageLoader';

// Lazy load all pages for code splitting
const Welcome = lazy(() => import('./pages/Welcome'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Reconciliation = lazy(() => import('./pages/Reconciliation'));
const Investments = lazy(() => import('./pages/Investments'));
const Budget = lazy(() => import('./pages/Budget'));
const Goals = lazy(() => import('./pages/Goals'));
const Analytics = lazy(() => import('./pages/Analytics'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const AppSettings = lazy(() => import('./pages/settings/AppSettings'));
const DataManagement = lazy(() => import('./pages/settings/DataManagement'));
const Categories = lazy(() => import('./pages/settings/Categories'));
const Tags = lazy(() => import('./pages/settings/Tags'));
const AccountTransactions = lazy(() => import('./pages/AccountTransactions'));

function App() {
  return (
    <ErrorBoundary>
      <SentryErrorBoundary fallback={(errorData) => <ErrorFallback error={errorData.error as Error} resetError={errorData.resetError} />} showDialog>
        <PreferencesProvider>
          <AppProvider>
            <LayoutProvider>
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
                  </Route>
                  <Route path="forecasting" element={<Navigate to="/budget" replace />} />
                </Route>
              </Routes>
            </Router>
          </LayoutProvider>
        </AppProvider>
      </PreferencesProvider>
      </SentryErrorBoundary>
    </ErrorBoundary>
  );
}

export default App;