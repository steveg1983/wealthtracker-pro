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

function App() {
  return (
    <PreferencesProvider>
      <AppProvider>
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
      </AppProvider>
    </PreferencesProvider>
  );
}

export default App;
