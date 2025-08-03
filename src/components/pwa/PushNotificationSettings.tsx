/**
 * Push Notification Settings
 * Allows users to manage their notification preferences
 */

import React from 'react';
import { usePushNotifications } from '../../services/pushNotificationService';
import { 
  BellIcon, 
  BellOffIcon,
  CheckIcon,
  AlertCircleIcon,
  BanknoteIcon,
  CalendarIcon,
  TargetIcon,
  TrendingUpIcon,
  BarChart3Icon,
  AlertTriangleIcon
} from '../icons';

export const PushNotificationSettings: React.FC = () => {
  const {
    permission,
    isSubscribed,
    preferences,
    requestPermission,
    subscribe,
    unsubscribe,
    updatePreferences,
    testNotification
  } = usePushNotifications();

  const [isLoading, setIsLoading] = React.useState(false);
  const [testSent, setTestSent] = React.useState(false);

  const handleToggleNotifications = async () => {
    setIsLoading(true);
    
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        if (permission !== 'granted') {
          const perm = await requestPermission();
          if (perm !== 'granted') {
            return;
          }
        }
        await subscribe();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    await testNotification();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const handlePreferenceChange = async (key: keyof typeof preferences, value: boolean) => {
    await updatePreferences({
      ...preferences,
      [key]: value
    });
  };

  const notificationTypes = [
    {
      key: 'budgetAlerts' as const,
      icon: BanknoteIcon,
      title: 'Budget Alerts',
      description: 'Get notified when you\'re close to your budget limits',
      color: 'text-blue-600'
    },
    {
      key: 'billReminders' as const,
      icon: CalendarIcon,
      title: 'Bill Reminders',
      description: 'Receive reminders for upcoming bills',
      color: 'text-purple-600'
    },
    {
      key: 'goalAchievements' as const,
      icon: TargetIcon,
      title: 'Goal Achievements',
      description: 'Celebrate when you reach your financial goals',
      color: 'text-green-600'
    },
    {
      key: 'investmentAlerts' as const,
      icon: TrendingUpIcon,
      title: 'Investment Alerts',
      description: 'Stay informed about significant portfolio changes',
      color: 'text-indigo-600'
    },
    {
      key: 'weeklyReports' as const,
      icon: BarChart3Icon,
      title: 'Weekly Reports',
      description: 'Get weekly summaries of your finances',
      color: 'text-teal-600'
    },
    {
      key: 'unusualSpending' as const,
      icon: AlertTriangleIcon,
      title: 'Unusual Spending Alerts',
      description: 'Be alerted when spending patterns change significantly',
      color: 'text-orange-600'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Main Toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isSubscribed ? (
              <BellIcon className="h-6 w-6 text-green-600" />
            ) : (
              <BellOffIcon className="h-6 w-6 text-gray-400" />
            )}
            <div>
              <h3 className="text-lg font-medium">Push Notifications</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isSubscribed 
                  ? 'You\'re receiving push notifications' 
                  : permission === 'denied'
                  ? 'Notifications are blocked. Enable them in browser settings.'
                  : 'Enable push notifications to stay updated'}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleToggleNotifications}
            disabled={isLoading || permission === 'denied'}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isSubscribed ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
            } ${isLoading || permission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isSubscribed ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {permission === 'denied' && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 dark:text-red-300">
                <p className="font-medium">Notifications are blocked</p>
                <p>To enable notifications:</p>
                <ol className="list-decimal list-inside mt-1">
                  <li>Click the lock icon in your browser's address bar</li>
                  <li>Find "Notifications" and change it to "Allow"</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {isSubscribed && (
          <button
            onClick={handleTestNotification}
            className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {testSent ? (
              <span className="flex items-center gap-1">
                <CheckIcon className="h-4 w-4" />
                Test notification sent!
              </span>
            ) : (
              'Send test notification'
            )}
          </button>
        )}
      </div>

      {/* Notification Types */}
      {isSubscribed && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b dark:border-gray-700">
            <h3 className="text-lg font-medium">Notification Preferences</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Choose which notifications you'd like to receive
            </p>
          </div>

          <div className="divide-y dark:divide-gray-700">
            {notificationTypes.map(({ key, icon: Icon, title, description, color }) => (
              <div key={key} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 ${color} mt-0.5`} />
                    <div className="flex-1">
                      <h4 className="font-medium">{title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {description}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handlePreferenceChange(key, !preferences[key])}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences[key] ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        preferences[key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};