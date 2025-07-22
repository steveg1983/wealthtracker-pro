import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { BellIcon, AlertCircleIcon } from './icons';

export default function BudgetAlertSettings() {
  const { 
    budgetAlertsEnabled, 
    setBudgetAlertsEnabled, 
    alertThreshold, 
    setAlertThreshold 
  } = useNotifications();

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6">
      <div className="flex items-center gap-3 mb-6">
        <BellIcon size={24} className="text-primary" />
        <h2 className="text-xl font-semibold text-theme-heading dark:text-white">Budget Alerts</h2>
      </div>

      <div className="space-y-6">
        {/* Enable/Disable Alerts */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Enable Budget Alerts</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Get notified when you're approaching or exceeding budget limits
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={budgetAlertsEnabled}
              onChange={(e) => setBudgetAlertsEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {/* Alert Threshold */}
        <div className={`transition-opacity ${budgetAlertsEnabled ? 'opacity-100' : 'opacity-50'}`}>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">Alert Threshold</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Receive a warning when spending reaches this percentage of your budget
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">Current threshold</span>
              <span className="text-lg font-semibold text-primary">{alertThreshold}%</span>
            </div>
            
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(parseInt(e.target.value))}
              disabled={!budgetAlertsEnabled}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: budgetAlertsEnabled 
                  ? `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${((alertThreshold - 50) / 45) * 100}%, rgb(229 231 235) ${((alertThreshold - 50) / 45) * 100}%, rgb(229 231 235) 100%)`
                  : undefined
              }}
            />
            
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>50%</span>
              <span>70%</span>
              <span>85%</span>
              <span>95%</span>
            </div>
          </div>
        </div>

        {/* Alert Types */}
        <div className={`transition-opacity ${budgetAlertsEnabled ? 'opacity-100' : 'opacity-50'}`}>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">Alert Types</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <AlertCircleIcon size={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Warning Alert</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Triggered when spending reaches {alertThreshold}% of budget
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertCircleIcon size={20} className="text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Danger Alert</p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Triggered when spending exceeds 100% of budget
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Example */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">Example:</span> If you have a £500 monthly food budget and alerts set to {alertThreshold}%, 
            you'll receive a warning when you've spent £{(500 * alertThreshold / 100).toFixed(0)}.
          </p>
        </div>
      </div>
    </div>
  );
}