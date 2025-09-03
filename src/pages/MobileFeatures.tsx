import React, { useState, useEffect } from 'react';
import { mobileService } from '../services/mobileService';
import { 
  PhoneIcon,
  CameraIcon,
  WifiOffIcon,
  BellIcon,
  MapPinIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
  RefreshCwIcon,
  SettingsIcon
} from '../components/icons';
import PageWrapper from '../components/PageWrapper';
import QuickExpenseCapture from '../components/QuickExpenseCapture';
import NotificationSettings from '../components/NotificationSettings';
import type { OfflineTransaction, PushNotification } from '../services/mobileService';
import { logger } from '../services/loggingService';

export default function MobileFeatures() {
  const [isOffline, setIsOffline] = useState(mobileService.isOffline());
  const [offlineTransactions, setOfflineTransactions] = useState<OfflineTransaction[]>([]);
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [notificationSettings, setNotificationSettings] = useState(mobileService.getNotificationSettings());
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadData();
    
    // Listen for network changes
    const handleOnline = () => loadData();
    const handleOffline = () => loadData();
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadData = () => {
    setIsOffline(mobileService.isOffline());
    setOfflineTransactions(mobileService.getOfflineTransactions());
    setNotifications(mobileService.getNotifications());
    setNotificationSettings(mobileService.getNotificationSettings());
    setIsPWAInstalled(mobileService.isPWAInstalled());
  };

  const handleSync = async () => {
    if (isOffline) return;
    
    setIsSyncing(true);
    try {
      await mobileService.syncOfflineTransactions();
      loadData();
    } catch (error) {
      logger.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInstallPWA = async () => {
    try {
      const canInstall = await mobileService.installPWA();
      if (canInstall) {
        alert('PWA installation available! Look for the install button in your browser.');
      } else {
        alert('PWA installation not available on this device.');
      }
    } catch (error) {
      logger.error('PWA installation failed:', error);
    }
  };

  const handleRequestNotificationPermission = async () => {
    const granted = await mobileService.requestNotificationPermission();
    if (granted) {
      setNotificationSettings(mobileService.getNotificationSettings());
    }
  };

  const handleMarkNotificationAsRead = (id: string) => {
    mobileService.markNotificationAsRead(id);
    setNotifications(mobileService.getNotifications());
  };

  const handleClearNotifications = () => {
    mobileService.clearNotifications();
    setNotifications([]);
  };

  const connectionStatus = mobileService.getConnectionStatus();

  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-800 dark:to-purple-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Mobile Features</h1>
              <p className="text-indigo-100">
                Enhanced mobile experience with offline support
              </p>
            </div>
            <PhoneIcon size={48} className="text-white/80" />
          </div>
        </div>

        {/* Connection Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Connection Status
            </h2>
            <div className="flex items-center gap-2">
              {isOffline ? (
                <WifiOffIcon size={20} className="text-red-500" />
              ) : (
                <CheckCircleIcon size={20} className="text-green-500" />
              )}
              <span className={`font-medium ${
                isOffline ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              }`}>
                {isOffline ? 'Offline' : connectionStatus}
              </span>
            </div>
          </div>

          {isOffline && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircleIcon size={20} className="text-red-600 dark:text-red-400" />
                <p className="font-medium text-red-800 dark:text-red-200">
                  You're currently offline
                </p>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300">
                Your transactions will be saved locally and synced when you're back online.
              </p>
            </div>
          )}

          {/* Offline Transactions */}
          {offlineTransactions.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ClockIcon size={20} className="text-yellow-600 dark:text-yellow-400" />
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    Pending Sync
                  </p>
                </div>
                <button
                  onClick={handleSync}
                  disabled={isOffline || isSyncing}
                  className="flex items-center gap-1 px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
                >
                  <RefreshCwIcon size={14} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                {offlineTransactions.length} transaction{offlineTransactions.length !== 1 ? 's' : ''} waiting to sync
              </p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setShowQuickCapture(true)}
              className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-left"
            >
              <CameraIcon size={24} className="text-green-600 dark:text-green-400" />
              <div>
                <h3 className="font-medium text-green-800 dark:text-green-200">
                  Quick Expense Capture
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Snap a photo of your receipt
                </p>
              </div>
            </button>

            <button
              onClick={() => setShowNotificationSettings(true)}
              className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-gray-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left"
            >
              <BellIcon size={24} className="text-gray-600 dark:text-gray-500" />
              <div>
                <h3 className="font-medium text-blue-800 dark:text-blue-200">
                  Notification Settings
                </h3>
                <p className="text-sm text-blue-700 dark:text-gray-300">
                  Configure alerts and reminders
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* PWA Installation */}
        {!isPWAInstalled && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Install Mobile App
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Add Wealth Tracker to your home screen for faster access and offline support
                </p>
              </div>
              <button
                onClick={handleInstallPWA}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                Install App
              </button>
            </div>
          </div>
        )}

        {/* Notifications */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Notifications
            </h2>
            <div className="flex items-center gap-2">
              {!notificationSettings.enabled && (
                <button
                  onClick={handleRequestNotificationPermission}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                >
                  Enable
                </button>
              )}
              <button
                onClick={() => setShowNotificationSettings(true)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <SettingsIcon size={16} />
              </button>
            </div>
          </div>

          {!notificationSettings.enabled ? (
            <div className="text-center py-8">
              <BellIcon size={48} className="mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Notifications Disabled
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Enable notifications to receive budget alerts and bill reminders
              </p>
              <button
                onClick={handleRequestNotificationPermission}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Enable Notifications
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircleIcon size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400">
                No notifications yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={handleClearNotifications}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  Clear All
                </button>
              </div>
              
              {notifications.slice(0, 5).map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    notification.read
                      ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                      : 'bg-blue-50 dark:bg-gray-900/20 border-blue-200 dark:border-blue-700'
                  }`}
                  onClick={() => handleMarkNotificationAsRead(notification.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {notification.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {notification.body}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {notification.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile Features Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Mobile Features
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <WifiOffIcon size={20} className="text-orange-600 dark:text-orange-400" />
                Offline Support
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Continue using the app without internet. All transactions are saved locally and synced when you're back online.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <CameraIcon size={20} className="text-green-600 dark:text-green-400" />
                Receipt Capture
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Take photos of receipts to automatically extract expense details using OCR technology.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <MapPinIcon size={20} className="text-gray-600 dark:text-gray-500" />
                Location Services
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automatically detect nearby merchants and categorize expenses based on your location.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <BellIcon size={20} className="text-purple-600 dark:text-purple-400" />
                Smart Notifications
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Get timely alerts for budget limits, bill reminders, and unusual spending patterns.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <QuickExpenseCapture
        isOpen={showQuickCapture}
        onClose={() => setShowQuickCapture(false)}
        onExpenseCreated={(expense) => {
          logger.info('Expense created', { expense });
          // Refresh data
          loadData();
        }}
      />

      <NotificationSettings
        isOpen={showNotificationSettings}
        onClose={() => {
          setShowNotificationSettings(false);
          setNotificationSettings(mobileService.getNotificationSettings());
        }}
      />
    </PageWrapper>
  );
}
