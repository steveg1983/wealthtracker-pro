/**
 * RealtimeSyncProvider - React context provider for real-time synchronization
 * 
 * This provider:
 * - Manages real-time sync state
 * - Provides sync controls to child components
 * - Handles automatic cleanup
 * - Integrates with React DevTools
 */

import React, { createContext, useContext, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import { useRealtimeSync, type UseRealtimeSyncReturn } from '../hooks/useRealtimeSync';

interface RealtimeSyncContextType extends UseRealtimeSyncReturn {
  /**
   * Enable/disable real-time sync
   */
  setEnabled: (enabled: boolean) => void;
  
  /**
   * Enable/disable notifications
   */
  setNotificationsEnabled: (enabled: boolean) => void;
}

const RealtimeSyncContext = createContext<RealtimeSyncContextType | null>(null);

interface RealtimeSyncProviderProps {
  children: React.ReactNode;
  
  /**
   * Default sync configuration
   */
  defaultConfig?: {
    enabled?: boolean;
    showNotifications?: boolean;
    syncData?: {
      accounts?: boolean;
      transactions?: boolean;
      budgets?: boolean;
      goals?: boolean;
    };
  };
}

export function RealtimeSyncProvider({ 
  children, 
  defaultConfig = {} 
}: RealtimeSyncProviderProps): React.JSX.Element {
  const {
    enabled = true,
    showNotifications = false, // Disable connection status notifications by default
    syncData = {
      accounts: true,
      transactions: true,
      budgets: true,
      goals: true,
    },
  } = defaultConfig;

  const realtimeSync = useRealtimeSync({
    enabled,
    showNotifications,
    preventEcho: true,
    syncData,
  });

  // These would need state management to be fully functional
  const setEnabled = useCallback((enabled: boolean) => {
    console.log('Setting real-time sync enabled:', enabled);
    // Would need to implement state management here
  }, []);

  const setNotificationsEnabled = useCallback((enabled: boolean) => {
    console.log('Setting real-time sync notifications enabled:', enabled);
    // Would need to implement state management here
  }, []);

  const contextValue: RealtimeSyncContextType = {
    ...realtimeSync,
    setEnabled,
    setNotificationsEnabled,
  };

  return (
    <RealtimeSyncContext.Provider value={contextValue}>
      {children}
      {/* Toast notifications container */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--color-background)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            fontSize: '14px',
            maxWidth: '400px',
          },
          success: {
            iconTheme: {
              primary: 'var(--color-success)',
              secondary: 'var(--color-background)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--color-error)',
              secondary: 'var(--color-background)',
            },
          },
        }}
      />
    </RealtimeSyncContext.Provider>
  );
}

/**
 * Hook to access real-time sync context
 */
export function useRealtimeSyncContext(): RealtimeSyncContextType {
  const context = useContext(RealtimeSyncContext);
  
  if (!context) {
    throw new Error('useRealtimeSyncContext must be used within a RealtimeSyncProvider');
  }
  
  return context;
}

/**
 * Optional hook that gracefully handles missing context
 */
export function useOptionalRealtimeSync(): RealtimeSyncContextType | null {
  return useContext(RealtimeSyncContext);
}

export default RealtimeSyncProvider;