import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Reconciliation from './pages/Reconciliation';
import Transactions from './pages/Transactions';
import Budget from './pages/Budget';
// import Budget from './pages/BudgetDebug';
// import Budget from './pages/BudgetSimple';
// import Budget from './pages/BudgetTest';
// import Budget from './pages/BudgetMinimal';
import Goals from './pages/Goals';
import Analytics from './pages/Analytics';
import Investments from './pages/Investments';
import Settings from './pages/Settings';
import AppearanceSettings from './pages/settings/Appearance';
import DataManagementSettings from './pages/settings/DataManagement';
import CategoriesSettings from './pages/settings/Categories';
import NetWorthSummary from './pages/NetWorthSummary';

function App() {
  return (
    <ErrorBoundary>
      <PreferencesProvider>
        <AppProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/reconciliation" element={<Reconciliation />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/budget" element={<Budget />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/investments" element={<Investments />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/settings/appearance" element={<AppearanceSettings />} />
                <Route path="/settings/data" element={<DataManagementSettings />} />
                <Route path="/settings/categories" element={<CategoriesSettings />} />
                <Route path="/networth" element={<NetWorthSummary />} />
                <Route path="/networth/:type" element={<NetWorthSummary />} />
              </Route>
            </Routes>
          </Router>
        </AppProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  );
}

export default App;