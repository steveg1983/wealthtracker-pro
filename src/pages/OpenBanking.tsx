import { useCallback, useEffect, useState } from 'react';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import PageWrapper from '../components/PageWrapper';
import { bankConnectionService } from '../services/bankConnectionService';
import type { BankConnection } from '../services/bankConnectionService';
import { BankIcon, ShieldIcon, CheckCircleIcon, RefreshCwIcon, TrashIcon, AlertCircleIcon, LinkIcon } from '../components/icons';
import LinkBankAccountsModal from '../components/banking/LinkBankAccountsModal';

type ConnectStatus = 'idle' | 'connecting' | 'error';

export default function OpenBanking() {
  const { getToken, isLoaded } = useClerkAuth();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus>('idle');
  const [connectError, setConnectError] = useState('');
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [linkingConnectionId, setLinkingConnectionId] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      bankConnectionService.setAuthTokenProvider(() => getToken());
      const result = await bankConnectionService.refreshConnections();
      setConnections(result);
    } catch {
      // Silent fail - connections list will be empty
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    void loadConnections();
  }, [isLoaded, loadConnections]);

  // Listen for OAuth callback completion from popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'wealthtracker:bank-oauth-complete') {
        void loadConnections();
        // Open linking modal if we have a connectionId from a successful OAuth flow
        if (event.data.status === 'success' && event.data.connectionId) {
          setLinkingConnectionId(event.data.connectionId);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadConnections]);

  const handleConnectBank = useCallback(async () => {
    setConnectStatus('connecting');
    setConnectError('');
    try {
      bankConnectionService.setAuthTokenProvider(() => getToken());
      const result = await bankConnectionService.connectBank('', 'truelayer');
      if (result.url) {
        window.location.href = result.url;
      } else {
        setConnectStatus('error');
        setConnectError('No authorization URL returned from server.');
      }
    } catch (err) {
      setConnectStatus('error');
      setConnectError(err instanceof Error ? err.message : 'Failed to start bank connection.');
    }
  }, [getToken]);

  const handleSync = useCallback(async (connectionId: string) => {
    setSyncingIds(prev => new Set(prev).add(connectionId));
    try {
      bankConnectionService.setAuthTokenProvider(() => getToken());
      await bankConnectionService.syncConnection(connectionId);
      await loadConnections();
    } catch {
      // Sync errors are shown via connection status
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  }, [getToken, loadConnections]);

  const handleDisconnect = useCallback(async (connectionId: string) => {
    setDeletingIds(prev => new Set(prev).add(connectionId));
    try {
      bankConnectionService.setAuthTokenProvider(() => getToken());
      await bankConnectionService.disconnect(connectionId);
      setConnections(prev => prev.filter(c => c.id !== connectionId));
    } catch {
      // Show error via alert or toast in future
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  }, [getToken]);

  const handleLinkComplete = useCallback(async (connectionId: string) => {
    setLinkingConnectionId(null);
    // After linking, sync transactions for the newly linked accounts
    setSyncingIds(prev => new Set(prev).add(connectionId));
    try {
      bankConnectionService.setAuthTokenProvider(() => getToken());
      await bankConnectionService.syncTransactionsOnly(connectionId);
      await loadConnections();
    } catch {
      // Sync errors shown via connection status
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  }, [getToken, loadConnections]);

  const connectedCount = connections.filter(c => c.status === 'connected').length;
  const totalAccounts = connections.reduce((sum, c) => sum + (c.accountsCount ?? 0), 0);

  return (
    <PageWrapper title="Open Banking">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Connected Banks</p>
              <p className="text-2xl font-bold">{connectedCount}</p>
            </div>
            <BankIcon size={32} className="text-blue-600" />
          </div>
        </div>
        <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Synced Accounts</p>
              <p className="text-2xl font-bold">{totalAccounts}</p>
            </div>
            <CheckCircleIcon size={32} className="text-green-600" />
          </div>
        </div>
        <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Security Status</p>
              <p className="text-lg font-semibold text-green-600">Secured</p>
            </div>
            <ShieldIcon size={32} className="text-green-600" />
          </div>
        </div>
      </div>

      {/* Connect Bank */}
      <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-2">Connect Your Bank</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Securely connect your bank accounts to automatically import transactions and keep your balances up to date.
        </p>
        <button
          type="button"
          onClick={handleConnectBank}
          disabled={connectStatus === 'connecting'}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <LinkIcon size={18} />
          {connectStatus === 'connecting' ? 'Redirecting to bank...' : 'Connect Bank Account'}
        </button>
        {connectStatus === 'error' && connectError && (
          <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
            <AlertCircleIcon size={16} />
            <span>{connectError}</span>
          </div>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          Bank connections are secured with 256-bit encryption
        </p>
      </div>

      {/* Connected Banks */}
      <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Connected Banks</h3>
        {isLoading ? (
          <p className="text-gray-500">Loading connections...</p>
        ) : connections.length === 0 ? (
          <p className="text-gray-500">No bank connections yet. Click &ldquo;Connect Bank Account&rdquo; to get started.</p>
        ) : (
          <div className="space-y-3">
            {connections.map(connection => (
              <div
                key={connection.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <BankIcon size={24} className="text-blue-600" />
                  <div>
                    <p className="font-medium">{connection.institutionName}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>
                        {connection.accountsCount ?? 0} account{(connection.accountsCount ?? 0) !== 1 ? 's' : ''}
                      </span>
                      {connection.lastSync && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">&middot;</span>
                          <span>Last synced: {new Date(connection.lastSync).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                    {connection.status === 'error' && (
                      <p className="text-xs text-red-500 mt-1">{connection.error ?? 'Connection error'}</p>
                    )}
                    {connection.status === 'reauth_required' && (
                      <p className="text-xs text-amber-500 mt-1">Re-authorization required</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {connection.status === 'connected' && (
                    <CheckCircleIcon size={18} className="text-green-500" />
                  )}
                  {connection.status === 'error' && (
                    <AlertCircleIcon size={18} className="text-red-500" />
                  )}
                  <button
                    type="button"
                    onClick={() => setLinkingConnectionId(connection.id)}
                    className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="Link bank accounts to your app accounts"
                  >
                    <LinkIcon size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSync(connection.id)}
                    disabled={syncingIds.has(connection.id)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg disabled:opacity-50 transition-colors"
                    title="Sync accounts & transactions"
                  >
                    <RefreshCwIcon size={18} className={syncingIds.has(connection.id) ? 'animate-spin' : ''} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(connection.id)}
                    disabled={deletingIds.has(connection.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50 transition-colors"
                    title="Disconnect bank"
                  >
                    <TrashIcon size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-blue-600 font-bold">1</span>
            </div>
            <h4 className="font-medium mb-1">Connect</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select your bank and authorize read-only access via Open Banking
            </p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-blue-600 font-bold">2</span>
            </div>
            <h4 className="font-medium mb-1">Sync</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your accounts and transactions are securely imported
            </p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-blue-600 font-bold">3</span>
            </div>
            <h4 className="font-medium mb-1">Track</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View all your finances in one place with automatic updates
            </p>
          </div>
        </div>
      </div>

      {/* Security Information */}
      <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <ShieldIcon size={24} className="text-green-600" />
          <h3 className="text-lg font-semibold">Bank-Level Security</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Data Protection</h4>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>• 256-bit encryption for all data</li>
              <li>• Read-only access to your accounts</li>
              <li>• No access to move money</li>
              <li>• Credentials never stored locally</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Privacy First</h4>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>• FCA-regulated Open Banking provider</li>
              <li>• No third-party data sharing</li>
              <li>• Delete connections anytime</li>
              <li>• Full control over your information</li>
            </ul>
          </div>
        </div>
      </div>
      {/* Link Bank Accounts Modal */}
      {linkingConnectionId && (
        <LinkBankAccountsModal
          isOpen={true}
          onClose={() => setLinkingConnectionId(null)}
          connectionId={linkingConnectionId}
          onLinkComplete={handleLinkComplete}
        />
      )}
    </PageWrapper>
  );
}
