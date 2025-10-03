/**
 * RealtimeSyncProvider - React context provider for real-time synchronization
 * 
 * This provider:
 * - Manages real-time sync state
 * - Provides sync controls to child components
 * - Handles automatic cleanup
 * - Integrates with React DevTools
 */

import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useRealtimeSync, type UseRealtimeSyncReturn } from '../hooks/useRealtimeSync';
import { advancedAnalyticsService } from '../services/advancedAnalyticsService';
import type { SpendingAnomaly } from '../services/advancedAnalyticsService';
import { useAppSelector } from '../store';
import Decimal from 'decimal.js';
import type { Transaction } from '../types';
import { useLogger } from '../services/ServiceProvider';

interface RealtimeSyncContextType extends UseRealtimeSyncReturn {
  /**
   * Enable/disable real-time sync
   */
  setEnabled: (enabled: boolean) => void;
  
  /**
   * Enable/disable notifications
   */
  setNotificationsEnabled: (enabled: boolean) => void;
  
  /**
   * Recent anomalies detected
   */
  recentAnomalies: SpendingAnomaly[];
  
  /**
   * Portfolio value change percentage (24h)
   */
  portfolioChange24h: number | null;
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

export function RealtimeSyncProvider({ children, 
  defaultConfig = {} 
}: RealtimeSyncProviderProps): React.JSX.Element {
  const logger = useLogger();
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
  
  // State for anomaly detection and portfolio monitoring
  const [recentAnomalies, setRecentAnomalies] = useState<SpendingAnomaly[]>([]);
  const [portfolioChange24h, setPortfolioChange24h] = useState<number | null>(null);
  const lastAnomalyCheckRef = useRef<Date>(new Date());
  const portfolioValueRef = useRef<InstanceType<typeof Decimal> | null>(null);
  
  // Get data from store
  const transactions = useAppSelector((state: any) => state.transactions.transactions);
  const accounts = useAppSelector((state: any) => state.accounts.accounts);

  // These would need state management to be fully functional
  const setEnabled = useCallback((enabled: boolean) => {
    logger.info('Setting real-time sync enabled', { enabled });
    // Would need to implement state management here
  }, []);

  const setNotificationsEnabled = useCallback((enabled: boolean) => {
    logger.info('Setting real-time sync notifications enabled', { enabled });
    // Would need to implement state management here
  }, []);
  
  // Check for spending anomalies on new transactions
  const checkForAnomalies = useCallback(async (newTransaction?: Transaction) => {
    try {
      // Only check if we have transactions and it's been at least 5 minutes since last check
      const now = new Date();
      const timeSinceLastCheck = now.getTime() - lastAnomalyCheckRef.current.getTime();
      
      if (transactions.length > 0 && (newTransaction || timeSinceLastCheck > 5 * 60 * 1000)) {
        const anomalies = await advancedAnalyticsService.detectSpendingAnomalies(
          transactions,
          6
        );
        
        // Filter to only show high and critical severity anomalies
        const significantAnomalies = anomalies.filter(
          a => a.severity === 'high' || a.severity === 'critical'
        );
        
        // Check for new anomalies
        const newAnomalies = significantAnomalies.filter(
          a => !recentAnomalies.some(existing => 
            existing.transactionId === a.transactionId
          )
        );
        
        // Show notifications for new anomalies
        if (showNotifications && newAnomalies.length > 0) {
          newAnomalies.forEach(anomaly => {
            const message = `Unusual ${anomaly.type === 'unusual_amount' ? 'amount' : 'pattern'} detected: ${anomaly.description}`;
            
            if (anomaly.severity === 'critical') {
              toast.error(message, {
                duration: 5000,
                icon: '⚠️',
              });
            } else {
              toast(message, {
                duration: 4000,
                icon: '📊',
              });
            }
          });
        }
        
        setRecentAnomalies(significantAnomalies);
        lastAnomalyCheckRef.current = now;
      }
    } catch (error) {
      console.error('Error checking for anomalies:', error);
    }
  }, [transactions, recentAnomalies, showNotifications]);
  
  // Calculate portfolio value changes
  const updatePortfolioMetrics = useCallback(() => {
    try {
      // Calculate total portfolio value from investment accounts
      const investmentAccounts = accounts.filter(
        (acc: any) => acc.type === 'investment' || acc.type === 'retirement'
      );
      
      if (investmentAccounts.length > 0) {
        const currentValue = investmentAccounts.reduce(
          (sum: any, acc: any) => sum.plus(new Decimal(acc.balance)),
          new Decimal(0)
        );
        
        // Calculate 24h change if we have a previous value
        if (portfolioValueRef.current) {
          const change = currentValue
            .minus(portfolioValueRef.current)
            .dividedBy(portfolioValueRef.current)
            .times(100)
            .toNumber();
          
          setPortfolioChange24h(change);
          
          // Show notification for significant changes
          if (showNotifications && Math.abs(change) > 2) {
            const message = `Portfolio ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(2)}% today`;
            const isPositive = change > 0;
            
            toast(message, {
              duration: 4000,
              icon: isPositive ? '📈' : '📉',
              style: {
                color: isPositive ? 'var(--color-success)' : 'var(--color-error)',
              },
            });
          }
        }
        
        portfolioValueRef.current = currentValue;
      }
    } catch (error) {
      console.error('Error updating portfolio metrics:', error);
    }
  }, [accounts, showNotifications]);

  // Check for anomalies periodically and on transaction changes
  useEffect(() => {
    if (!enabled) return;
    
    // Initial check
    checkForAnomalies();
    
    // Set up periodic checks
    const interval = setInterval(() => {
      checkForAnomalies();
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    return () => clearInterval(interval);
  }, [enabled, checkForAnomalies, transactions.length]);
  
  // Update portfolio metrics on account changes
  useEffect(() => {
    if (!enabled) return;
    
    updatePortfolioMetrics();
    
    // Update every minute for real-time feel
    const interval = setInterval(() => {
      updatePortfolioMetrics();
    }, 60 * 1000);
    
    return () => clearInterval(interval);
  }, [enabled, updatePortfolioMetrics, accounts]);
  
  const contextValue: RealtimeSyncContextType = {
    ...realtimeSync,
    setEnabled,
    setNotificationsEnabled,
    recentAnomalies,
    portfolioChange24h,
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
