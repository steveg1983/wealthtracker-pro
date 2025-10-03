/**
 * SupabaseDataLoader - Loads data from Supabase into Redux on app startup
 * 
 * This component:
 * 1. Loads all data from Supabase when the user is authenticated
 * 2. Handles the initial data loading with proper loading states
 * 3. Provides fallback to localStorage if Supabase is unavailable
 * 4. Syncs offline changes when connection is restored
 */

import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAuth } from '../contexts/AuthContext';
import { userIdService } from '../services/userIdService';
import { AppDispatch } from '../store';
import { loadAllData } from '../store/thunks';
import PageLoader from './PageLoader';
import { useLogger } from '../services/ServiceProvider';

interface SupabaseDataLoaderProps {
  children: React.ReactNode;
}

export function SupabaseDataLoader({ children }: SupabaseDataLoaderProps) {
  const logger = useLogger();
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [dataLoading, setDataLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only load data when user is authenticated and we have a user ID
    if (isAuthenticated && user && !authLoading && !dataLoaded && !dataLoading) {
      const loadData = async () => {
        setDataLoading(true);
        setError(null);
        
        // Ensure user exists in database and get database ID
        const databaseId = await userIdService.ensureUserExists(
          user.id,
          user.email || 'user@example.com',
          (user as any).firstName,
          (user as any).lastName
        );

        if (!databaseId) {
          logger.error('Failed to initialize user in database');
          setError('Failed to initialize user account. Please try refreshing the page.');
          setDataLoaded(true);
          setDataLoading(false);
          return;
        }
        
        // Store user ID for the thunks to use (for backward compatibility)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('current_user_id', user.id);
        }
        
        // Load all data from Supabase
        dispatch(loadAllData())
          .unwrap()
          .then(() => {
            logger.info('Data loaded successfully from Supabase');
            setDataLoaded(true);
          })
          .catch((error) => {
            logger.error('❌ Failed to load data from Supabase:', error);
            setError('Failed to load your data. Please try refreshing the page.');
            // Still mark as loaded so the app can function with cached data
            setDataLoaded(true);
          })
          .finally(() => {
            setDataLoading(false);
          });
      };

      loadData();
    }
  }, [dispatch, isAuthenticated, user, authLoading, dataLoaded, dataLoading]);

  // Show loading while authenticating or loading data
  if (authLoading || (isAuthenticated && !dataLoaded)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50 dark:bg-gray-900">
        <div className="text-center">
          <PageLoader />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            {authLoading ? 'Authenticating...' : 'Loading your financial data...'}
          </p>
          {dataLoading && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              Syncing with cloud storage
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show error if data loading failed
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-4 text-red-500">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 8.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Data Loading Error
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <button
            onClick={() => {
              setError(null);
              setDataLoaded(false);
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // If not authenticated, just render children (login page, etc.)
  return <>{children}</>;
}
