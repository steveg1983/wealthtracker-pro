import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { AppProvider } from './contexts/AppContext';
import { LayoutProvider } from './contexts/LayoutContext';
import Layout from './components/Layout';
// Import pages directly without lazy loading
import Welcome from './pages/Welcome';
import Dashboard from './pages/Dashboard';

function AppSimple() {
  console.log('AppSimple rendering');
  
  return (
    <ErrorBoundary>
      <PreferencesProvider>
        <AppProvider>
          <LayoutProvider>
            <Router>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Welcome />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="*" element={<div>Page not found</div>} />
                </Route>
              </Routes>
            </Router>
          </LayoutProvider>
        </AppProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  );
}

export default AppSimple;