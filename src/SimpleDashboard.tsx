import { useApp } from './contexts/AppContext';
import { usePreferences } from './contexts/PreferencesContext';

export default function SimpleDashboard() {
  const { accounts, transactions } = useApp();
  const { firstName } = usePreferences();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Welcome{firstName ? `, ${firstName}` : ''}!
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Accounts</h2>
          <p className="text-3xl font-bold text-blue-600">{accounts.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Transactions</h2>
          <p className="text-3xl font-bold text-green-600">{transactions.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Status</h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">All systems working</p>
        </div>
      </div>
    </div>
  );
}