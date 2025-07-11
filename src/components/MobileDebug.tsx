import { useApp } from '../contexts/AppContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useState } from 'react';
import { generateTestData } from '../utils/generateTestData';

export default function MobileDebug() {
  const { accounts, transactions, budgets } = useApp();
  const { accentColor, theme } = usePreferences();
  const [showDebug, setShowDebug] = useState(false);
  
  // Only show on mobile devices
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (!isMobile) return null;
  
  const forceLoadTestData = () => {
    try {
      const testData = generateTestData();
      localStorage.setItem('wealthtracker_accounts', JSON.stringify(testData.accounts));
      localStorage.setItem('wealthtracker_transactions', JSON.stringify(testData.transactions));
      localStorage.setItem('wealthtracker_budgets', JSON.stringify(testData.budgets));
      window.location.reload();
    } catch (error) {
      alert(`Error: ${error}`);
    }
  };
  
  return (
    <>
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="fixed bottom-4 left-4 bg-gray-800 text-white p-2 rounded-full text-xs z-50"
      >
        Debug
      </button>
      
      {showDebug && (
        <div className="fixed bottom-16 left-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg z-50 text-xs max-w-xs">
          <h3 className="font-bold mb-2">Debug Info</h3>
          <p>Accounts: {accounts.length}</p>
          <p>Transactions: {transactions.length}</p>
          <p>Budgets: {budgets.length}</p>
          <p>Theme: {theme}</p>
          <p>Accent: {accentColor}</p>
          <p>LocalStorage: {typeof Storage !== 'undefined' ? 'Yes' : 'No'}</p>
          <p>User Agent: {navigator.userAgent.substring(0, 50)}...</p>
          
          <button
            onClick={forceLoadTestData}
            className="mt-3 bg-purple-500 text-white px-3 py-1 rounded text-xs w-full"
          >
            Force Load Test Data
          </button>
          
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="mt-2 bg-red-500 text-white px-3 py-1 rounded text-xs w-full"
          >
            Clear All & Reload
          </button>
        </div>
      )}
    </>
  );
}
