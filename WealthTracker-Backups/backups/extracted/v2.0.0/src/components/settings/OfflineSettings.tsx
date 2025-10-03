import React, { useState, useEffect } from 'react';
import { useOffline } from '../../hooks/useOffline';
import { offlineService } from '../../services/offlineService';
import { formatBytes } from '../../utils/formatters';
import { Button } from '../common/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { WifiOffIcon, DatabaseIcon, RefreshCwIcon, TrashIcon, DownloadIcon } from '../icons';

export function OfflineSettings(): React.JSX.Element {
  const { isOffline, isSyncing, pendingChanges, syncNow, clearOfflineData } = useOffline();
  const [cacheSize, setCacheSize] = useState<number | null>(null);
  const [isCalculatingSize, setIsCalculatingSize] = useState(false);

  useEffect(() => {
    calculateCacheSize();
  }, []);

  const calculateCacheSize = async () => {
    setIsCalculatingSize(true);
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        setCacheSize(estimate.usage || 0);
      }
    } catch (error) {
      console.error('Failed to calculate cache size:', error);
    } finally {
      setIsCalculatingSize(false);
    }
  };

  const clearCache = async () => {
    if (confirm('Are you sure you want to clear all cached data? This will remove all offline data.')) {
      try {
        // Clear service worker caches
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        
        // Clear offline data
        await clearOfflineData();
        
        // Recalculate size
        await calculateCacheSize();
        
        alert('Cache cleared successfully');
      } catch (error) {
        console.error('Failed to clear cache:', error);
        alert('Failed to clear cache');
      }
    }
  };

  const downloadOfflineData = async () => {
    try {
      // Get all offline data
      const transactions = await offlineService.getTransactions();
      const data = {
        transactions,
        exportDate: new Date().toISOString(),
        pendingChanges,
      };
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wealthtracker-offline-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download offline data:', error);
      alert('Failed to download offline data');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WifiOffIcon className="h-5 w-5" />
            Offline Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Connection Status</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isOffline ? 'Currently offline' : 'Online'}
                </p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                isOffline 
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200' 
                  : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
              }`}>
                {isOffline ? 'Offline' : 'Online'}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Pending Changes</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Changes waiting to sync
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {pendingChanges}
                </span>
                {pendingChanges > 0 && !isOffline && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={syncNow}
                    isLoading={isSyncing}
                    leftIcon={RefreshCwIcon}
                  >
                    Sync Now
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseIcon className="h-5 w-5" />
            Offline Storage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Cache Size</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Space used for offline data
                </p>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {isCalculatingSize ? (
                  <span className="text-sm text-gray-500">Calculating...</span>
                ) : cacheSize !== null ? (
                  formatBytes(cacheSize)
                ) : (
                  'Unknown'
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={downloadOfflineData}
                leftIcon={DownloadIcon}
              >
                Download Offline Data
              </Button>
              
              <Button
                variant="danger"
                fullWidth
                onClick={clearCache}
                leftIcon={TrashIcon}
              >
                Clear All Offline Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Offline Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Auto-sync when online</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically sync changes when connection is restored
                </p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Background sync</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Sync data in the background when the app is closed
                </p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Conflict notifications</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Show notifications when sync conflicts occur
                </p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}