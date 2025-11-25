/**
 * Real-time Service - Handles Supabase real-time subscriptions
 * 
 * This service provides:
 * - Centralized subscription management
 * - Connection state tracking
 * - Event filtering and processing
 * - Automatic reconnection logic
 * - Subscription lifecycle management
 */

import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { userIdService } from './userIdService';
import { createScopedLogger, type ScopedLogger } from '../loggers/scopedLogger';
import type { Account, Transaction, Budget, Goal } from '../types';

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeEvent<T = unknown> {
  eventType: RealtimeEventType;
  new: T | null;
  old: T | null;
  table: string;
  schema: string;
}

export interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnected: Date | null;
  lastDisconnected: Date | null;
  connectionCount: number;
}

export type RealtimeCallback<T = unknown> = (event: RealtimeEvent<T>) => void;
export type ConnectionCallback = (state: ConnectionState) => void;

type UserIdServiceLike = typeof userIdService;
type SupabaseLike = SupabaseClient | null;
export interface RealtimeServiceOptions {
  supabaseClient?: SupabaseLike;
  userIdService?: UserIdServiceLike;
  logger?: ScopedLogger;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export class RealtimeService {
  private subscriptions: Map<string, RealtimeChannel> = new Map();
  private connectionState: ConnectionState = {
    isConnected: false,
    isReconnecting: false,
    lastConnected: null,
    lastDisconnected: null,
    connectionCount: 0,
  };
  private connectionCallbacks: Set<ConnectionCallback> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private isInitialized = false;
  private supabaseClient: SupabaseLike;
  private userService: UserIdServiceLike;
  private readonly logger: ScopedLogger;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;

  constructor(options: RealtimeServiceOptions = {}) {
    this.supabaseClient = options.supabaseClient ?? supabase ?? null;
    this.userService = options.userIdService ?? userIdService;
    this.logger = options.logger ?? createScopedLogger('RealtimeService');
    this.setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  }

  /**
   * Initialize the real-time service
   */
  initialize(): void {
    if (this.isInitialized || !this.supabaseClient) {
      return;
    }

    this.isInitialized = true;
    this.setupConnectionMonitoring();
  }

  /**
   * Setup connection monitoring and automatic reconnection
   */
  private setupConnectionMonitoring(): void {
    if (!this.supabaseClient) return;

    // For Supabase v2, we monitor connection through channel status
    // Set initial connection state as connected (optimistic)
    this.handleConnectionChange(true);
    
    // We'll monitor connection through subscription events instead
    this.logger.info('Realtime monitoring initialized');
  }

  /**
   * Handle connection state changes
   */
  private handleConnectionChange(isConnected: boolean): void {
    const now = new Date();
    const wasConnected = this.connectionState.isConnected;

    this.connectionState = {
      ...this.connectionState,
      isConnected,
      isReconnecting: false,
      lastConnected: isConnected ? now : this.connectionState.lastConnected,
      lastDisconnected: !isConnected ? now : this.connectionState.lastDisconnected,
      connectionCount: isConnected && !wasConnected 
        ? this.connectionState.connectionCount + 1 
        : this.connectionState.connectionCount,
    };

    // Clear reconnect timeout if connection is restored
    if (isConnected && this.reconnectTimeout) {
      this.clearTimeoutFn(this.reconnectTimeout);
      this.reconnectTimeout = null;
      this.reconnectAttempts = 0;
    }

    // Attempt reconnection if disconnected
    if (!isConnected && !this.reconnectTimeout) {
      this.scheduleReconnect();
    }

    // Notify listeners
    this.notifyConnectionCallbacks();
  }

  /**
   * Schedule automatic reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.warn('Max reconnection attempts reached');
      return;
    }

    this.connectionState.isReconnecting = true;
    this.notifyConnectionCallbacks();

    // Exponential backoff
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    
    this.reconnectTimeout = this.setTimeoutFn(() => {
      this.logger.info('Attempting to reconnect', {
        attempt: this.reconnectAttempts + 1,
        max: this.maxReconnectAttempts
      });
      this.reconnectAttempts++;
      
      // Attempt to reconnect by re-establishing subscriptions
      this.reconnectAllSubscriptions();
    }, delay);
  }

  /**
   * Reconnect all active subscriptions
   */
  private reconnectAllSubscriptions(): void {
    if (!this.supabaseClient) return;

    const subscriptionKeys = Array.from(this.subscriptions.keys());
    
    subscriptionKeys.forEach(key => {
      const channel = this.subscriptions.get(key);
      if (channel) {
        // Remove old subscription
        channel.unsubscribe();
        this.subscriptions.delete(key);
        
        // Re-establish subscription based on key pattern
        const [table, userId] = key.split(':');
        this.reestablishSubscription(table, userId);
      }
    });
  }

  /**
   * Re-establish a specific subscription
   */
  private reestablishSubscription(table: string, userId: string): void {
    // This would need to be enhanced based on specific subscription requirements
    // For now, we'll let the application re-subscribe when needed
    this.logger.info('Re-establishing subscription', { table, userId });
  }

  /**
   * Subscribe to accounts changes
   * @param clerkOrDbId - Can be either Clerk ID or database UUID
   */
  async subscribeToAccounts(
    clerkOrDbId: string,
    callback: RealtimeCallback<Account>,
    _options: { includeInitial?: boolean } = {}
  ): Promise<string | null> {
    if (!this.supabaseClient || !clerkOrDbId) return null;

    // Convert Clerk ID to database UUID if needed
    let dbUserId = clerkOrDbId;
    if (clerkOrDbId.startsWith('user_')) {
      const resolvedId = await this.userService.getDatabaseUserId(clerkOrDbId);
      if (!resolvedId) {
        this.logger.error('[RealtimeService] Could not resolve database ID for Clerk ID:', clerkOrDbId);
        return null;
      }
      dbUserId = resolvedId;
    }

    const subscriptionKey = `accounts:${dbUserId}`;
    
    // Remove existing subscription if any
    this.unsubscribe(subscriptionKey);

    const channel = this.supabaseClient
      .channel(`accounts_${dbUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${dbUserId}`,
        },
        (payload) => {
          const event: RealtimeEvent<Account> = {
            eventType: payload.eventType,
            new: payload.new as Account | null,
            old: payload.old as Account | null,
            table: payload.table,
            schema: payload.schema,
          };
          
          this.logger.info('Accounts real-time event:', event);
          callback(event);
        }
      )
      .subscribe((status, err) => {
        this.logger.info(`Accounts subscription status: ${status}`);
        if (status === 'SUBSCRIBED') {
          this.handleConnectionChange(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.logger.error(`Accounts subscription error: ${err?.message || status}`);
          this.handleConnectionChange(false);
        }
      });

    this.subscriptions.set(subscriptionKey, channel);
    return subscriptionKey;
  }

  /**
   * Subscribe to transactions changes
   * @param clerkOrDbId - Can be either Clerk ID or database UUID
   */
  async subscribeToTransactions(
    clerkOrDbId: string,
    callback: RealtimeCallback<Transaction>,
    _options: { includeInitial?: boolean } = {}
  ): Promise<string | null> {
    if (!this.supabaseClient || !clerkOrDbId) return null;

    // Convert Clerk ID to database UUID if needed
    let dbUserId = clerkOrDbId;
    if (clerkOrDbId.startsWith('user_')) {
      const resolvedId = await this.userService.getDatabaseUserId(clerkOrDbId);
      if (!resolvedId) {
        this.logger.error('[RealtimeService] Could not resolve database ID for Clerk ID:', clerkOrDbId);
        return null;
      }
      dbUserId = resolvedId;
    }

    const subscriptionKey = `transactions:${dbUserId}`;
    
    // Remove existing subscription if any
    this.unsubscribe(subscriptionKey);

    const channel = this.supabaseClient
      .channel(`transactions_${dbUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${dbUserId}`,
        },
        (payload) => {
          const event: RealtimeEvent<Transaction> = {
            eventType: payload.eventType,
            new: payload.new as Transaction | null,
            old: payload.old as Transaction | null,
            table: payload.table,
            schema: payload.schema,
          };
          
      this.logger.info('Transactions real-time event:', event);
          callback(event);
        }
      )
      .subscribe((status, err) => {
        this.logger.info(`Transactions subscription status: ${status}`);
        if (status === 'SUBSCRIBED') {
          this.handleConnectionChange(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.logger.error(`Transactions subscription error: ${err?.message || status}`);
          this.handleConnectionChange(false);
        }
      });

    this.subscriptions.set(subscriptionKey, channel);
    return subscriptionKey;
  }

  /**
   * Subscribe to budgets changes
   * @param clerkOrDbId - Can be either Clerk ID or database UUID
   */
  async subscribeToBudgets(
    clerkOrDbId: string,
    callback: RealtimeCallback<Budget>,
    _options: { includeInitial?: boolean } = {}
  ): Promise<string | null> {
    if (!this.supabaseClient || !clerkOrDbId) return null;

    // Convert Clerk ID to database UUID if needed
    let dbUserId = clerkOrDbId;
    if (clerkOrDbId.startsWith('user_')) {
      const resolvedId = await this.userService.getDatabaseUserId(clerkOrDbId);
      if (!resolvedId) {
        this.logger.error('[RealtimeService] Could not resolve database ID for Clerk ID:', clerkOrDbId);
        return null;
      }
      dbUserId = resolvedId;
    }

    const subscriptionKey = `budgets:${dbUserId}`;
    
    // Remove existing subscription if any
    this.unsubscribe(subscriptionKey);

    const channel = this.supabaseClient
      .channel(`budgets_${dbUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'budgets',
          filter: `user_id=eq.${dbUserId}`,
        },
        (payload) => {
          const event: RealtimeEvent<Budget> = {
            eventType: payload.eventType,
            new: payload.new as Budget | null,
            old: payload.old as Budget | null,
            table: payload.table,
            schema: payload.schema,
          };
          
          this.logger.info('Budgets real-time event:', event);
          callback(event);
        }
      )
      .subscribe((status, err) => {
        this.logger.info(`Budgets subscription status: ${status}`);
        if (status === 'SUBSCRIBED') {
          this.handleConnectionChange(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.logger.error(`Budgets subscription error: ${err?.message || status}`);
          this.handleConnectionChange(false);
        }
      });

    this.subscriptions.set(subscriptionKey, channel);
    return subscriptionKey;
  }

  /**
   * Subscribe to goals changes
   * @param clerkOrDbId - Can be either Clerk ID or database UUID
   */
  async subscribeToGoals(
    clerkOrDbId: string,
    callback: RealtimeCallback<Goal>,
    _options: { includeInitial?: boolean } = {}
  ): Promise<string | null> {
    if (!this.supabaseClient || !clerkOrDbId) return null;

    // Convert Clerk ID to database UUID if needed
    let dbUserId = clerkOrDbId;
    if (clerkOrDbId.startsWith('user_')) {
      const resolvedId = await this.userService.getDatabaseUserId(clerkOrDbId);
      if (!resolvedId) {
        this.logger.error('[RealtimeService] Could not resolve database ID for Clerk ID:', clerkOrDbId);
        return null;
      }
      dbUserId = resolvedId;
    }

    const subscriptionKey = `goals:${dbUserId}`;
    
    // Remove existing subscription if any
    this.unsubscribe(subscriptionKey);

    const channel = this.supabaseClient
      .channel(`goals_${dbUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goals',
          filter: `user_id=eq.${dbUserId}`,
        },
        (payload) => {
          const event: RealtimeEvent<Goal> = {
            eventType: payload.eventType,
            new: payload.new as Goal | null,
            old: payload.old as Goal | null,
            table: payload.table,
            schema: payload.schema,
          };
          
          this.logger.info('Goals real-time event:', event);
          callback(event);
        }
      )
      .subscribe((status, err) => {
        this.logger.info(`Goals subscription status: ${status}`);
        if (status === 'SUBSCRIBED') {
          this.handleConnectionChange(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.logger.error(`Goals subscription error: ${err?.message || status}`);
          this.handleConnectionChange(false);
        }
      });

    this.subscriptions.set(subscriptionKey, channel);
    return subscriptionKey;
  }

  /**
   * Unsubscribe from a specific subscription
   */
  unsubscribe(subscriptionKey: string): void {
    const channel = this.subscriptions.get(subscriptionKey);
    if (channel) {
      channel.unsubscribe();
      this.subscriptions.delete(subscriptionKey);
    this.logger.info(`Unsubscribed from: ${subscriptionKey}`);
    }
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    this.subscriptions.forEach((channel, key) => {
      channel.unsubscribe();
      this.logger.info(`Unsubscribed from: ${key}`);
    });
    this.subscriptions.clear();

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
        this.clearTimeoutFn(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.connectionState.isConnected = false;
    this.connectionState.isReconnecting = false;
    this.notifyConnectionCallbacks();
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    
    // Immediately call with current state
    callback(this.connectionState);
    
    // Return unsubscribe function
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  /**
   * Notify all connection callbacks
   */
  private notifyConnectionCallbacks(): void {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(this.connectionState);
      } catch (error) {
        this.logger.error('Error in connection callback:', error as Error);
      }
    });
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Force reconnection
   */
  forceReconnect(): void {
    if (this.reconnectTimeout) {
      this.clearTimeoutFn(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.reconnectAttempts = 0;
    this.scheduleReconnect();
  }

  /**
   * Cleanup service
   */
  destroy(): void {
    this.unsubscribeAll();
    this.connectionCallbacks.clear();
    this.isInitialized = false;
    this.reconnectAttempts = 0;
    
    if (this.reconnectTimeout) {
      this.clearTimeoutFn(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService();
export default realtimeService;
