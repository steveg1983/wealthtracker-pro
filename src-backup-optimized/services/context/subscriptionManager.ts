import { DataService } from '../api/dataService';
import { AccountOperations } from './accountOperations';
import { TransactionOperations } from './transactionOperations';
import { lazyLogger as logger } from '../serviceFactory';

interface SubscriptionCallbacks {
  onAccountUpdate: (accounts: any[]) => void;
  onTransactionUpdate: (transactions: any[]) => void;
  onSyncComplete: () => void;
}

export class SubscriptionManager {
  private static lastUpdateRef: { type: string; timestamp: number } | null = null;
  private static updateDebounceRef: NodeJS.Timeout | null = null;
  private static unsubscribeFns: (() => void)[] = [];

  static async initialize(
    userId: string,
    callbacks: SubscriptionCallbacks
  ): Promise<() => void> {
    try {
      if (!DataService.isUsingSupabase()) {
        logger.debug('[SubscriptionManager] Not using Supabase, skipping subscriptions');
        return () => {};
      }

      logger.debug('[SubscriptionManager] Initializing real-time subscriptions');

      // Helper function to debounce updates
      const debouncedUpdate = (updateType: string, updateFn: () => Promise<void>) => {
        // Check if this is a duplicate update (within 1 second)
        const now = Date.now();
        if (this.lastUpdateRef && 
            this.lastUpdateRef.type === updateType && 
            now - this.lastUpdateRef.timestamp < 1000) {
          logger.debug(`[SubscriptionManager] Skipping duplicate ${updateType} update`);
          return;
        }
        
        // Clear any pending debounced update
        if (this.updateDebounceRef) {
          clearTimeout(this.updateDebounceRef);
        }
        
        // Set a new debounced update
        this.updateDebounceRef = setTimeout(async () => {
          this.lastUpdateRef = { type: updateType, timestamp: now };
          await updateFn();
        }, 200); // 200ms debounce
      };

      // Subscribe to account updates
      const unsubscribeAccounts = await AccountOperations.subscribeToUpdates(
        userId,
        async (payload) => {
          logger.debug('[SubscriptionManager] Account update received:', payload.eventType);
          
          debouncedUpdate('account', async () => {
            try {
              const updatedAccounts = await AccountOperations.getAccounts(userId);
              callbacks.onAccountUpdate(updatedAccounts);
              
              // Also refresh transactions to update account balances
              const updatedTransactions = await TransactionOperations.getTransactions();
              callbacks.onTransactionUpdate(updatedTransactions);
              
              callbacks.onSyncComplete();
            } catch (error) {
              logger.error('[SubscriptionManager] Failed to handle account update:', error);
            }
          });
        }
      );
      this.unsubscribeFns.push(unsubscribeAccounts);

      // Subscribe to transaction updates
      const unsubscribeTransactions = TransactionOperations.subscribeToUpdates(
        async (payload) => {
          logger.debug('[SubscriptionManager] Transaction update received');
          
          debouncedUpdate('transaction', async () => {
            try {
              const updatedTransactions = await TransactionOperations.getTransactions();
              callbacks.onTransactionUpdate(updatedTransactions);
              
              // Also refresh accounts to update balances
              const updatedAccounts = await DataService.getAccounts();
              callbacks.onAccountUpdate(updatedAccounts);
              
              callbacks.onSyncComplete();
            } catch (error) {
              logger.error('[SubscriptionManager] Failed to handle transaction update:', error);
            }
          });
        }
      );
      this.unsubscribeFns.push(unsubscribeTransactions);

      // Return cleanup function
      return () => {
        logger.debug('[SubscriptionManager] Cleaning up subscriptions');
        if (this.updateDebounceRef) {
          clearTimeout(this.updateDebounceRef);
        }
        this.unsubscribeFns.forEach(fn => fn());
        this.unsubscribeFns = [];
      };
    } catch (error) {
      logger.error('[SubscriptionManager] Failed to initialize subscriptions:', error);
      return () => {};
    }
  }

  static cleanup(): void {
    if (this.updateDebounceRef) {
      clearTimeout(this.updateDebounceRef);
    }
    this.unsubscribeFns.forEach(fn => fn());
    this.unsubscribeFns = [];
  }
}