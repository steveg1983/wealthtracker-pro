/**
 * SupabaseDataLoader — auth-aware loading/error shell around the app.
 *
 * Shows a loading screen while authentication or the initial data load is in
 * flight, and an error screen (with retry) if the load fails.
 *
 * Data loading itself happens in AppContextSupabase. This component used to
 * ALSO dispatch loadAllData() into the Redux store — fetching every entity a
 * second time into a store nothing read — which is why the Redux dependency
 * is gone.
 */

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContextSupabase';
import PageLoader from './PageLoader';

interface SupabaseDataLoaderProps {
  children: React.ReactNode;
}

export function SupabaseDataLoader({ children }: SupabaseDataLoaderProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading: dataLoading, syncError } = useApp();

  // Show loading while authenticating or while the initial data load runs
  if (authLoading || (isAuthenticated && dataLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <PageLoader />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            {authLoading ? 'Authenticating...' : 'Loading your financial data...'}
          </p>
        </div>
      </div>
    );
  }

  // Show error if the initial data load failed
  if (isAuthenticated && syncError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-4 text-red-500">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 8.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Data Loading Error
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {syncError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
