import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { AlertCircleIcon, DollarSignIcon } from './icons';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import ToggleSwitch from './ui/ToggleSwitch';

export default function LargeTransactionAlertSettings() {
  const { 
    largeTransactionAlertsEnabled, 
    setLargeTransactionAlertsEnabled, 
    largeTransactionThreshold, 
    setLargeTransactionThreshold 
  } = useNotifications();
  const { formatCurrency } = useCurrencyDecimal();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <AlertCircleIcon size={24} className="text-yellow-600" />
        <h2 className="text-xl font-semibold text-theme-heading dark:text-white">Large Transaction Warnings</h2>
      </div>

      <div className="space-y-6">
        {/* Enable/Disable Alerts */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Enable Large Transaction Warnings</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Get notified when adding transactions above a certain amount
            </p>
          </div>
          <ToggleSwitch
            checked={largeTransactionAlertsEnabled}
            onChange={setLargeTransactionAlertsEnabled}
            aria-label="Large transaction alerts"
          />
        </div>

        {/* Threshold Amount */}
        <div className={`transition-opacity ${largeTransactionAlertsEnabled ? 'opacity-100' : 'opacity-50'}`}>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">Warning Threshold</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Show a warning for transactions equal to or greater than this amount
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <DollarSignIcon size={20} className="text-gray-500" />
              <input
                type="number"
                aria-label="Large transaction alert threshold"
                min="50"
                max="10000"
                step="50"
                value={largeTransactionThreshold}
                onChange={(e) => setLargeTransactionThreshold(parseInt(e.target.value) || 500)}
                disabled={!largeTransactionAlertsEnabled}
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-800-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-lg font-semibold text-primary min-w-[100px] text-right">
                {formatCurrency(largeTransactionThreshold)}
              </span>
            </div>
            
            {/* Quick presets */}
            <div className="flex gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Quick set:</span>
              {[100, 250, 500, 1000, 2500].map(amount => (
                <button
                  key={amount}
                  onClick={() => setLargeTransactionThreshold(amount)}
                  disabled={!largeTransactionAlertsEnabled}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    largeTransactionThreshold === amount
                      ? 'bg-[#1a2332] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {formatCurrency(amount)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Alert Preview */}
        <div className={`transition-opacity ${largeTransactionAlertsEnabled ? 'opacity-100' : 'opacity-50'}`}>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">What happens?</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <AlertCircleIcon size={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Warning Notification</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  When you add a transaction of {formatCurrency(largeTransactionThreshold)} or more, you'll receive a notification
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Use Cases */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">Useful for:</span> Monitoring large purchases, detecting potential fraud, 
            keeping track of significant expenses, and maintaining awareness of major financial decisions.
          </p>
        </div>
      </div>
    </div>
  );
}