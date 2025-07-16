import { Link } from 'react-router-dom';
import { TargetIcon, GoalIcon, LineChartIcon, TrendingUpIcon, CalculatorIcon } from '../components/icons';
import { usePreferences } from '../contexts/PreferencesContext';

export default function Forecasting() {
  const { showBudget, showGoals } = usePreferences();

  return (
    <div>
      <div className="mb-6">
        <div className="bg-[#6B86B3] dark:bg-gray-700 rounded-2xl shadow p-4">
          <h1 className="text-3xl font-bold text-white">Forecasting</h1>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {showBudget && (
          <Link 
            to="/budget"
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 border border-white/20 dark:border-gray-700/50"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                <TargetIcon className="text-blue-600 dark:text-blue-400" size={32} />
              </div>
              <h2 className="text-xl font-semibold text-blue-800 dark:text-white">Budget</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Track your spending against monthly or yearly budgets by category
            </p>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <span>Manage budgets</span>
              <TrendingUpIcon size={16} />
            </div>
          </Link>
        )}

        {showGoals && (
          <Link 
            to="/goals"
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-6 border border-white/20 dark:border-gray-700/50"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl">
                <GoalIcon className="text-green-600 dark:text-green-400" size={32} />
              </div>
              <h2 className="text-xl font-semibold text-blue-800 dark:text-white">Goals</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Set and track financial goals for savings, debt payoff, and investments
            </p>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <span>View goals</span>
              <CalculatorIcon size={16} />
            </div>
          </Link>
        )}
      </div>

      {!showBudget && !showGoals && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg p-12 text-center border border-white/20 dark:border-gray-700/50">
          <LineChartIcon className="mx-auto text-gray-400 mb-4" size={48} />
          <h2 className="text-xl font-semibold text-blue-800 dark:text-white mb-2">
            No Forecasting Features Enabled
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Enable Budget or Goals features in Settings to start planning your financial future.
          </p>
          <Link
            to="/settings/app"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors"
          >
            Go to Settings
          </Link>
        </div>
      )}
    </div>
  );
}