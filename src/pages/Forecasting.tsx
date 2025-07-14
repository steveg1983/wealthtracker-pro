import { Link } from 'react-router-dom';
import { Target, Goal, LineChart, TrendingUp, Calculator } from 'lucide-react';
import { usePreferences } from '../contexts/PreferencesContext';

export default function Forecasting() {
  const { showBudget, showGoals } = usePreferences();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-blue-900 dark:text-white">Forecasting</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Plan your financial future with budgets and goals
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {showBudget && (
          <Link 
            to="/budget"
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Target className="text-blue-600 dark:text-blue-400" size={32} />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Budget</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Track your spending against monthly or yearly budgets by category
            </p>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <span>Manage budgets</span>
              <TrendingUp size={16} />
            </div>
          </Link>
        )}

        {showGoals && (
          <Link 
            to="/goals"
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <Goal className="text-green-600 dark:text-green-400" size={32} />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Goals</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Set and track financial goals for savings, debt payoff, and investments
            </p>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <span>View goals</span>
              <Calculator size={16} />
            </div>
          </Link>
        )}
      </div>

      {!showBudget && !showGoals && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <LineChart className="mx-auto text-gray-400 mb-4" size={48} />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Forecasting Features Enabled
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Enable Budget or Goals features in Settings to start planning your financial future.
          </p>
          <Link
            to="/settings/app"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Settings
          </Link>
        </div>
      )}
    </div>
  );
}