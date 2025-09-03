import React from 'react';
import { useAppSelector, useAppDispatch } from '../store';
import { updatePreferences } from '../store/slices/preferencesSlice';
import { 
  UserIcon, 
  GlobeIcon, 
  SunIcon, 
  MoonIcon,
  CheckIcon
} from './icons';

/**
 * Preferences component using Redux directly
 * Demonstrates preference management with Redux
 */
export function PreferencesRedux() {
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(state => state.preferences);
  
  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];
  const themes = ['light', 'dark', 'system'] as const;
  
  const handleUpdatePreference = (key: string, value: string | boolean) => {
    dispatch(updatePreferences({ [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Redux Indicator */}
      <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
        <p className="text-sm text-purple-700 dark:text-purple-300">
          <strong>Redux Preferences:</strong> Settings are managed through Redux store.
        </p>
      </div>

      {/* User Profile */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
          <UserIcon size={20} />
          User Profile
        </h3>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              value={preferences.firstName || ''}
              onChange={(e) => handleUpdatePreference('firstName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter your first name"
            />
          </div>
          
          {/* Email field commented out - not available in Redux state
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={preferences.email || ''}
              onChange={(e) => handleUpdatePreference('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter your email"
            />
          </div>
          */}
        </div>
      </div>

      {/* Currency Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
          <GlobeIcon size={20} />
          Currency
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {currencies.map(currency => (
            <button
              key={currency}
              onClick={() => handleUpdatePreference('currency', currency)}
              className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                preferences.currency === currency
                  ? 'border-gray-600 bg-blue-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-500'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{currency}</span>
                {preferences.currency === currency && (
                  <CheckIcon size={16} />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Theme Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-white">
          <SunIcon size={20} />
          Theme
        </h3>
        
        <div className="grid grid-cols-3 gap-3">
          {themes.map(theme => (
            <button
              key={theme}
              onClick={() => handleUpdatePreference('theme', theme)}
              className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                preferences.theme === theme
                  ? 'border-gray-600 bg-blue-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-500'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                {theme === 'light' && <SunIcon size={20} />}
                {theme === 'dark' && <MoonIcon size={20} />}
                {theme === 'system' && (
                  <div className="flex">
                    <SunIcon size={16} />
                    <MoonIcon size={16} />
                  </div>
                )}
                <span className="capitalize font-medium">{theme}</span>
                {preferences.theme === theme && (
                  <CheckIcon size={16} />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Notification Settings - These fields are not available in Redux state yet */}
      {/* 
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">
          Notification Preferences
        </h3>
        
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Email notifications</span>
            <input
              type="checkbox"
              checked={preferences.emailNotifications || false}
              onChange={(e) => handleUpdatePreference('emailNotifications', e.target.checked)}
              className="w-5 h-5 text-gray-600 rounded focus:ring-gray-500"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Budget alerts</span>
            <input
              type="checkbox"
              checked={preferences.budgetAlerts || false}
              onChange={(e) => handleUpdatePreference('budgetAlerts', e.target.checked)}
              className="w-5 h-5 text-gray-600 rounded focus:ring-gray-500"
            />
          </label>
          
          <label className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Transaction reminders</span>
            <input
              type="checkbox"
              checked={preferences.transactionReminders || false}
              onChange={(e) => handleUpdatePreference('transactionReminders', e.target.checked)}
              className="w-5 h-5 text-gray-600 rounded focus:ring-gray-500"
            />
          </label>
        </div>
      </div>
      */}

      {/* Goal Celebration Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">
          Goal Settings
        </h3>
        
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Enable goal celebrations</span>
            <input
              type="checkbox"
              checked={preferences.goalCelebration || false}
              onChange={(e) => handleUpdatePreference('goalCelebration', e.target.checked)}
              className="w-5 h-5 text-gray-600 rounded focus:ring-gray-500"
            />
          </label>
        </div>
      </div>

      {/* Redux State Preview */}
      <div className="bg-blue-50 dark:bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">
          Current Redux State
        </h3>
        <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto">
          {JSON.stringify(preferences, null, 2)}
        </pre>
      </div>
    </div>
  );
}