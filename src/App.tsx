import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Transactions from './pages/Transactions';
import Investments from './pages/Investments';
import Budget from './pages/Budget';
import Goals from './pages/Goals';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { useEffect } from 'react';

function AppContent() {
  useEffect(() => {
    // Force pink accent if yellow on mount
    const root = document.documentElement;
    if (root.classList.contains('accent-yellow')) {
      root.classList.remove('accent-yellow');
      root.classList.add('accent-pink');
    }
    
    // Log initialization
    console.log('App initialized', {
      localStorage: typeof Storage !== 'undefined',
      theme: localStorage.getItem('money_management_theme'),
      accent: localStorage.getItem('money_management_accent_color'),
      accounts: localStorage.getItem('wealthtracker_accounts')?.length || 0
    });
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="investments" element={<Investments />} />
          <Route path="budget" element={<Budget />} />
          <Route path="goals" element={<Goals />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <PreferencesProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </PreferencesProvider>
  );
}

export default App;
