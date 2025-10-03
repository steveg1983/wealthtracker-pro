/**
 * Notification Settings Page
 * Manages push notification preferences and settings
 */

import React from 'react';
import PageWrapper from '../../components/PageWrapper';
import { PushNotificationSettings } from '../../components/pwa/PushNotificationSettings';
import { BellIcon } from '../../components/icons';

export default function Notifications() {
  return (
    <PageWrapper 
      title="Notification Settings" 
      icon={BellIcon}
      breadcrumbs={[
        { label: 'Settings', path: '/settings' },
        { label: 'Notifications', path: '/settings/notifications' }
      ]}
    >
      <div className="max-w-3xl mx-auto">
        <PushNotificationSettings />
        
        {/* Additional settings sections can be added here */}
        <div className="mt-8 bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            About Push Notifications
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Push notifications help you stay on top of your finances with timely alerts about budgets, 
            bills, goals, and more. You can customize which notifications you receive and when.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Notifications work even when the app is closed, as long as you have an internet connection.
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}