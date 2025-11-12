import { useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { AppProvider } from './contexts/AppContext';
import { LayoutProvider } from './contexts/LayoutContext';
import Layout from './components/Layout';
import PageLoader from './components/PageLoader';
import { createScopedLogger } from './loggers/scopedLogger';

// Test lazy loading
const Welcome = lazy(() => import('./pages/Welcome'));
const stepLogger = createScopedLogger('AppStepByStep');

export default function AppStepByStep() {
  const [step, setStep] = useState(1);
  
  stepLogger.info('Rendering AppStepByStep', { step });
  
  if (step === 1) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Step 1: Basic Router</h1>
        <Router>
          <div>Router works!</div>
        </Router>
        <button onClick={() => setStep(2)}>Next: Add Providers</button>
      </div>
    );
  }
  
  if (step === 2) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Step 2: With Providers</h1>
        <ErrorBoundary>
          <PreferencesProvider>
            <AppProvider>
              <LayoutProvider>
                <Router>
                  <div>All providers work!</div>
                </Router>
              </LayoutProvider>
            </AppProvider>
          </PreferencesProvider>
        </ErrorBoundary>
        <button onClick={() => setStep(3)}>Next: Add Layout</button>
      </div>
    );
  }
  
  if (step === 3) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Step 3: With Layout</h1>
        <ErrorBoundary>
          <PreferencesProvider>
            <AppProvider>
              <LayoutProvider>
                <Router>
                  <Routes>
                    <Route path="/" element={<Layout />}>
                      <Route index element={<div>Home page content</div>} />
                    </Route>
                  </Routes>
                </Router>
              </LayoutProvider>
            </AppProvider>
          </PreferencesProvider>
        </ErrorBoundary>
        <button onClick={() => setStep(4)}>Next: Add Lazy Loading</button>
      </div>
    );
  }
  
  if (step === 4) {
    return (
      <ErrorBoundary>
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
                  </Route>
                </Routes>
              </Router>
            </LayoutProvider>
          </AppProvider>
        </PreferencesProvider>
      </ErrorBoundary>
    );
  }
  
  return <div>Done!</div>;
}
