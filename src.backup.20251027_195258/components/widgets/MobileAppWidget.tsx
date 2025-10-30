import React, { useState, useEffect } from 'react';
import { mobileService } from '../../services/mobileService';
import { 
  PhoneIcon,
  CameraIcon,
  WifiOffIcon,
  BellIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon
} from '../icons';
import { useNavigate } from 'react-router-dom';
import type { OfflineTransaction } from '../../services/mobileService';
import type { BaseWidgetProps } from '../../types/widget-types';
import { logger } from '../../services/loggingService';

type MobileAppWidgetProps = BaseWidgetProps;

export default function MobileAppWidget({ size = 'medium' }: MobileAppWidgetProps) {
  const navigate = useNavigate();
  const [isOffline, setIsOffline] = useState(mobileService.isOffline());
  const [offlineTransactions, setOfflineTransactions] = useState<OfflineTransaction[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);

  useEffect(() => {
    // Check offline status and transactions
    const updateOfflineStatus = () => {
      setIsOffline(mobileService.isOffline());
      setOfflineTransactions(mobileService.getOfflineTransactions());
    };
    
    updateOfflineStatus();
    
    // Check notification status
    const settings = mobileService.getNotificationSettings();
    setNotificationsEnabled(settings.enabled);
    
    // Check PWA installation
    setIsPWAInstalled(mobileService.isPWAInstalled());
    
    // Listen for network changes
    const handleOnline = () => updateOfflineStatus();
    const handleOffline = () => updateOfflineStatus();
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleOpenQuickCapture = () => {
    // This would open the QuickExpenseCapture modal
    // For now, we'll just show a message
    alert('Quick expense capture feature coming soon!');
  };

  const handleInstallPWA = async () => {
    try {
      const canInstall = await mobileService.installPWA();
      if (canInstall) {
        // Show installation prompt
        alert('PWA installation available! Look for the install button in your browser.');
      } else {
        alert('PWA installation not available on this device.');
      }
    } catch (error) {
      logger.error('PWA installation failed:', error);
    }
  };

  if (size === 'small') {
    return (
      <div className="h-full flex flex-col cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors p-3">
        <div className="flex items-center justify-between mb-2">
          <PhoneIcon size={20} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Mobile</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            {isOffline ? (
              <>
                <WifiOffIcon size={24} className="text-red-500 mx-auto mb-1" />
                <p className="text-xs text-red-600 dark:text-red-400">Offline</p>
              </>
            ) : (
              <>
                <CheckCircleIcon size={24} className="text-green-500 mx-auto mb-1" />
                <p className="text-xs text-green-600 dark:text-green-400">Online</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <PhoneIcon size={20} className="text-indigo-600 dark:text-indigo-400" />
          Mobile App
        </h3>
        <div className="flex items-center gap-1">
          {isOffline ? (
            <WifiOffIcon size={16} className="text-red-500" />
          ) : (
            <CheckCircleIcon size={16} className="text-green-500" />
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isOffline ? 'Offline' : 'Online'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        {/* Offline Status */}
        {isOffline && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <WifiOffIcon size={16} className="text-red-600 dark:text-red-400" />
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                You're offline
              </p>
            </div>
            <p className="text-xs text-red-700 dark:text-red-300">
              {offlineTransactions.length} transactions queued for sync
            </p>
          </div>
        )}

        {/* PWA Installation */}
        {!isPWAInstalled && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
            <div className="flex items-center gap-2 mb-2">
              <PhoneIcon size={16} className="text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Install App
              </p>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              Add to home screen for faster access
            </p>
            <button
              onClick={handleInstallPWA}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
            >
              Install Now
            </button>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-2">
          <button
            onClick={handleOpenQuickCapture}
            className="w-full flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            <CameraIcon size={16} className="text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-800 dark:text-green-200">
              Quick Expense Capture
            </span>
          </button>
          
          <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              <BellIcon size={16} className="text-purple-600 dark:text-purple-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Notifications
              </span>
            </div>
            <div className="flex items-center gap-1">
              {notificationsEnabled ? (
                <CheckCircleIcon size={14} className="text-green-500" />
              ) : (
                <AlertCircleIcon size={14} className="text-red-500" />
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {notificationsEnabled ? 'On' : 'Off'}
              </span>
            </div>
          </div>
        </div>

        {/* Sync Status */}
        {offlineTransactions.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <ClockIcon size={16} className="text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Pending Sync
              </p>
            </div>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              {offlineTransactions.length} transaction{offlineTransactions.length !== 1 ? 's' : ''} waiting to sync
            </p>
          </div>
        )}

        {/* Connection Quality */}
        {!isOffline && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">Connection:</span>
              <span className="font-medium text-gray-900 dark:text-white capitalize">
                {mobileService.getConnectionStatus()}
              </span>
            </div>
          </div>
        )}

        {/* Mobile Features Button */}
        <button
          onClick={() => navigate('/mobile-features')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          Mobile Features
          <ArrowRightIcon size={14} />
        </button>
      </div>
    </div>
  );
}
