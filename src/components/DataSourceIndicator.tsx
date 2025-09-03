import React from 'react';
import { getDataSource, FEATURES } from '../config/database';
import { CloudIcon, DatabaseIcon, WifiOffIcon } from './icons';
import { useApp } from '../contexts/AppContextSupabase';

export default function DataSourceIndicator(): React.JSX.Element | null {
  const { isSyncing, syncError, lastSyncTime } = useApp();
  const dataSource = getDataSource();
  // Only show in development or if explicitly enabled
  if (!FEATURES.showDataSource && !import.meta.env.DEV) {
    return null;
  }
  
  // Check if we're online
  const isOnline = navigator.onLine;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 min-w-[200px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Data Source
          </span>
          {!isOnline && (
            <WifiOffIcon size={14} className="text-yellow-500" />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {dataSource === 'supabase' ? (
            <>
              <CloudIcon size={16} className="text-green-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Cloud Database
              </span>
            </>
          ) : (
            <>
              <DatabaseIcon size={16} className="text-blue-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Local Storage
              </span>
            </>
          )}
        </div>

        {dataSource === 'supabase' && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Status:
              </span>
              <span className={`text-xs font-medium ${
                syncError ? 'text-red-500' : 
                isSyncing ? 'text-yellow-500' : 
                'text-green-500'
              }`}>
                {syncError ? 'Error' : isSyncing ? 'Syncing...' : 'Synced'}
              </span>
            </div>
            
            {lastSyncTime && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Last sync:
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  {new Date(lastSyncTime).toLocaleTimeString()}
                </span>
              </div>
            )}
            
            {syncError && (
              <div className="mt-2 text-xs text-red-500">
                {syncError}
              </div>
            )}
          </div>
        )}

        {dataSource === 'localStorage' && !isOnline && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              Working offline - data saved locally
            </p>
          </div>
        )}

        {dataSource === 'localStorage' && isOnline && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Configure Supabase for cloud sync
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
