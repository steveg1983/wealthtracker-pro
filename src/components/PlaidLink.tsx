import React, { useState, useCallback } from 'react';
import { plaidService, PlaidPublicToken } from '../services/plaidService';
import { useApp } from '../contexts/AppContextSupabase';
import { LinkIcon, RefreshCwIcon, TrashIcon, AlertCircleIcon, CheckCircleIcon } from './icons';
import { logger } from '../services/loggingService';

interface PlaidLinkProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export default function PlaidLink({ onSuccess, onError }: PlaidLinkProps) {
  const [isLinking, setIsLinking] = useState(false);
  const [connections, setConnections] = useState(plaidService.getConnections());
  const [syncingConnections, setSyncingConnections] = useState<Set<string>>(new Set());
  const { addAccount, addTransaction } = useApp();

  // Simulate Plaid Link flow
  const handleConnectBank = useCallback(async () => {
    setIsLinking(true);
    try {
      // In production, you would:
      // 1. Create a link token from your backend
      // 2. Initialize Plaid Link with the token
      // 3. Handle the onSuccess callback with public token
      
      // Simulated Plaid Link success
      const simulatedPublicToken: PlaidPublicToken = {
        public_token: `public-sandbox-${Date.now()}`,
        institution_id: 'ins_1',
        institution_name: 'Chase Bank',
        accounts: [
          {
            account_id: `acc-${Date.now()}-1`,
            balances: {
              available: 2500,
              current: 2600,
              iso_currency_code: 'USD',
              limit: null,
              unofficial_currency_code: null
            },
            mask: '1234',
            name: 'Checking',
            official_name: 'Chase Total Checking',
            type: 'depository',
            subtype: 'checking'
          },
          {
            account_id: `acc-${Date.now()}-2`,
            balances: {
              available: 15000,
              current: 15000,
              iso_currency_code: 'USD',
              limit: null,
              unofficial_currency_code: null
            },
            mask: '5678',
            name: 'Savings',
            official_name: 'Chase Savings',
            type: 'depository',
            subtype: 'savings'
          }
        ]
      };

      // Add the connection
      const connection = await plaidService.addConnection(simulatedPublicToken);
      
      // Sync accounts immediately
      const accounts = await plaidService.syncAccounts(connection.id);
      
      // Add accounts to the app
      accounts.forEach(account => {
        addAccount(account);
      });
      
      // Refresh connections list
      setConnections(plaidService.getConnections());
      
      if (onSuccess) onSuccess();
    } catch (error) {
      logger.error('Failed to connect bank:', error);
      if (onError) onError(error as Error);
    } finally {
      setIsLinking(false);
    }
  }, [addAccount, onSuccess, onError]);

  // Sync accounts and transactions for a connection
  const handleSync = useCallback(async (connectionId: string) => {
    setSyncingConnections(prev => new Set(prev).add(connectionId));
    try {
      // Sync accounts
      const accounts = await plaidService.syncAccounts(connectionId);
      accounts.forEach(account => {
        addAccount(account);
      });
      
      // Sync transactions for the last 30 days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const transactions = await plaidService.syncTransactions(connectionId, startDate);
      transactions.forEach(transaction => {
        addTransaction(transaction);
      });
      
      // Refresh connections
      setConnections(plaidService.getConnections());
    } catch (error) {
      logger.error('Sync failed:', error);
      plaidService.updateConnectionStatus(connectionId, 'error', (error as Error).message);
      setConnections(plaidService.getConnections());
    } finally {
      setSyncingConnections(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  }, [addAccount, addTransaction]);

  // Remove a connection
  const handleRemoveConnection = useCallback((connectionId: string) => {
    if (confirm('Are you sure you want to remove this bank connection? This will not delete the imported accounts or transactions.')) {
      plaidService.removeConnection(connectionId);
      setConnections(plaidService.getConnections());
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Connect New Bank Button */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Connect Your Bank</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Securely connect your bank accounts to automatically import transactions and keep your balances up to date.
        </p>
        <button
          onClick={handleConnectBank}
          disabled={isLinking}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <LinkIcon size={20} />
          {isLinking ? 'Connecting...' : 'Connect Bank Account'}
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Bank connections are secured with 256-bit encryption
        </p>
      </div>

      {/* Connected Banks */}
      {connections.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Connected Banks</h3>
          <div className="space-y-4">
            {connections.map(connection => (
              <div
                key={connection.id}
                className="flex items-center justify-between p-4 border dark:border-gray-700 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{connection.institutionName}</h4>
                    {connection.status === 'active' && (
                      <CheckCircleIcon size={16} className="text-green-600" />
                    )}
                    {connection.status === 'error' && (
                      <AlertCircleIcon size={16} className="text-red-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {connection.accounts.length} accounts connected
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Last synced: {connection.lastSync.toLocaleString()}
                  </p>
                  {connection.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Error: {connection.error}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSync(connection.id)}
                    disabled={syncingConnections.has(connection.id)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Sync accounts and transactions"
                  >
                    <RefreshCwIcon 
                      size={20} 
                      className={syncingConnections.has(connection.id) ? 'animate-spin' : ''}
                    />
                  </button>
                  <button
                    onClick={() => handleRemoveConnection(connection.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg"
                    title="Remove connection"
                  >
                    <TrashIcon size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
          How It Works
        </h4>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-400">
          <li>• Your bank credentials are never stored in the app</li>
          <li>• Connections are secured using bank-level encryption</li>
          <li>• Transactions sync automatically every 24 hours</li>
          <li>• You can manually sync anytime by clicking the refresh button</li>
          <li>• Remove connections anytime without losing imported data</li>
        </ul>
      </div>
    </div>
  );
}