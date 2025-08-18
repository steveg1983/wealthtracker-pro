/**
 * RealtimeSyncTest - Component for testing real-time synchronization
 * 
 * This component provides:
 * - Manual testing interface for real-time sync
 * - Connection status display
 * - Mock data creation for testing
 * - Subscription management controls
 */

import React, { useState } from 'react';
import { useOptionalRealtimeSync } from '../contexts/RealtimeSyncProvider';
import realtimeService from '../services/realtimeService';
import { useAppDispatch, useAppSelector } from '../store';
import { createAccountInSupabase, createTransactionInSupabase } from '../store/thunks/supabaseThunks';
import type { Account, Transaction } from '../types';

export function RealtimeSyncTest(): React.JSX.Element {
  const realtimeSync = useOptionalRealtimeSync();
  const dispatch = useAppDispatch();
  const { accounts } = useAppSelector(state => state.accounts);
  const { transactions } = useAppSelector(state => state.transactions);
  const [isCreating, setIsCreating] = useState(false);

  // Mock data for testing
  const createTestAccount = async () => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const mockAccount: Omit<Account, 'id' | 'lastUpdated'> = {
        name: `Test Account ${Date.now()}`,
        type: 'checking',
        balance: Math.floor(Math.random() * 10000),
        currency: 'USD',
        institution: 'Test Bank',
        isActive: true,
        updatedAt: new Date().toISOString(),
      };

      await dispatch(createAccountInSupabase(mockAccount));
      console.log('Created test account:', mockAccount);
    } catch (error) {
      console.error('Failed to create test account:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const createTestTransaction = async () => {
    if (isCreating || accounts.length === 0) return;
    setIsCreating(true);

    try {
      const randomAccount = accounts[Math.floor(Math.random() * accounts.length)];
      const mockTransaction: Omit<Transaction, 'id'> = {
        accountId: randomAccount.id,
        date: new Date().toISOString().split('T')[0],
        description: `Test Transaction ${Date.now()}`,
        amount: parseFloat((Math.random() * 1000).toFixed(2)),
        type: Math.random() > 0.5 ? 'expense' : 'income',
        category: 'testing',
        notes: 'Created for real-time sync testing',
        tags: ['test', 'realtime'],
      };

      await dispatch(createTransactionInSupabase(mockTransaction));
      console.log('Created test transaction:', mockTransaction);
    } catch (error) {
      console.error('Failed to create test transaction:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const getConnectionStatusText = () => {
    if (!realtimeSync) return 'Real-time sync not available';
    
    const { connectionState } = realtimeSync;
    if (connectionState.isConnected) {
      return 'Connected';
    } else if (connectionState.isReconnecting) {
      return 'Reconnecting...';
    } else {
      return 'Disconnected';
    }
  };

  const getConnectionStatusColor = () => {
    if (!realtimeSync) return 'bg-gray-500';
    
    const { connectionState } = realtimeSync;
    if (connectionState.isConnected) {
      return 'bg-green-500';
    } else if (connectionState.isReconnecting) {
      return 'bg-yellow-500';
    } else {
      return 'bg-red-500';
    }
  };

  if (!realtimeSync) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Real-time Sync Test
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Real-time sync is not available. Make sure you are logged in and the RealtimeSyncProvider is configured.
        </p>
      </div>
    );
  }

  const { connectionState, subscriptionCount, reconnect, isActive } = realtimeSync;

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        Real-time Sync Test
      </h3>

      {/* Connection Status */}
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
          Connection Status
        </h4>
        <div className="flex items-center space-x-3 mb-3">
          <div className={`w-3 h-3 rounded-full ${getConnectionStatusColor()}`} />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {getConnectionStatusText()}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <span className="font-medium">Active:</span> {isActive ? 'Yes' : 'No'}
          </div>
          <div>
            <span className="font-medium">Subscriptions:</span> {subscriptionCount}
          </div>
          {connectionState.lastConnected && (
            <div>
              <span className="font-medium">Last connected:</span>{' '}
              {connectionState.lastConnected.toLocaleTimeString()}
            </div>
          )}
          <div>
            <span className="font-medium">Connections:</span> {connectionState.connectionCount}
          </div>
        </div>

        {!connectionState.isConnected && (
          <button
            onClick={reconnect}
            disabled={connectionState.isReconnecting}
            className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connectionState.isReconnecting ? 'Reconnecting...' : 'Reconnect'}
          </button>
        )}
      </div>

      {/* Test Actions */}
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
          Test Actions
        </h4>
        <div className="space-y-3">
          <button
            onClick={createTestAccount}
            disabled={isCreating}
            className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Test Account'}
          </button>
          
          <button
            onClick={createTestTransaction}
            disabled={isCreating || accounts.length === 0}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Test Transaction'}
          </button>
          
          {accounts.length === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Create an account first to test transactions
            </p>
          )}
        </div>
      </div>

      {/* Current Data */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
          Current Data
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
            <div className="font-medium text-gray-900 dark:text-white">Accounts</div>
            <div className="text-gray-600 dark:text-gray-400">{accounts.length} total</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
            <div className="font-medium text-gray-900 dark:text-white">Transactions</div>
            <div className="text-gray-600 dark:text-gray-400">{transactions.length} total</div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h5 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
          Testing Instructions
        </h5>
        <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
          <li>1. Open this page in multiple browser tabs or windows</li>
          <li>2. Create test data in one tab using the buttons above</li>
          <li>3. Watch for real-time updates in other tabs</li>
          <li>4. Check for toast notifications when data syncs</li>
          <li>5. Try disconnecting your internet to test offline behavior</li>
        </ul>
      </div>
    </div>
  );
}

export default RealtimeSyncTest;