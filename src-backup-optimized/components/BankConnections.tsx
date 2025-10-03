import React, { useState, useEffect } from 'react';
import { bankConnectionService, type BankConnection, type BankInstitution } from '../services/bankConnectionService';
import { Modal } from './common/Modal';
import { 
  Building2Icon, 
  RefreshCwIcon, 
  LinkIcon, 
  UnlinkIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
  SearchIcon
} from './icons';
import { format } from 'date-fns';
import { useLogger } from '../services/ServiceProvider';

interface BankConnectionsProps {
  onAccountsLinked?: () => void;
}

export default function BankConnections({ onAccountsLinked  }: BankConnectionsProps) {
  const logger = useLogger();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [institutions, setInstitutions] = useState<BankInstitution[]>([]);
  const [showAddBank, setShowAddBank] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncingConnections, setSyncingConnections] = useState<Set<string>>(new Set());
  const [configStatus, setConfigStatus] = useState({ plaid: false, trueLayer: false });

  useEffect(() => {
    loadConnections();
    loadInstitutions();
    checkConfig();
  }, []);

  const loadConnections = () => {
    setConnections(bankConnectionService.getConnections());
  };

  const loadInstitutions = async () => {
    const inst = await bankConnectionService.getInstitutions();
    setInstitutions(inst);
  };

  const checkConfig = () => {
    setConfigStatus(bankConnectionService.getConfigStatus());
  };

  const handleConnect = async (institution: BankInstitution) => {
    setIsLoading(true);
    try {
      const result = await bankConnectionService.connectBank(
        institution.id,
        institution.provider
      );

      if (result.url) {
        // Open OAuth flow in new window
        const authWindow = window.open(
          result.url,
          'bankAuth',
          'width=500,height=700,left=200,top=100'
        );

        // Listen for OAuth callback
        const checkAuth = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkAuth);
            loadConnections();
            setShowAddBank(false);
          }
        }, 1000);
      } else if (result.linkToken) {
        // Handle Plaid Link flow
        alert('Plaid Link integration would open here with token: ' + result.linkToken);
      }
    } catch (error) {
      logger.error('Failed to connect bank:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async (connectionId: string) => {
    setSyncingConnections(prev => new Set(prev).add(connectionId));
    
    try {
      const result = await bankConnectionService.syncConnection(connectionId);
      
      if (result.success) {
        loadConnections();
        onAccountsLinked?.();
      } else {
        logger.error('Sync failed:', result.errors);
      }
    } finally {
      setSyncingConnections(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  };

  const handleSyncAll = async () => {
    const activeConnections = connections.filter(c => c.status === 'connected');
    
    for (const connection of activeConnections) {
      await handleSync(connection.id);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (confirm('Are you sure you want to disconnect this bank? This will stop automatic syncing.')) {
      await bankConnectionService.disconnect(connectionId);
      loadConnections();
    }
  };

  const getStatusIcon = (status: BankConnection['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircleIcon size={16} className="text-green-600 dark:text-green-400" />;
      case 'error':
        return <AlertCircleIcon size={16} className="text-red-600 dark:text-red-400" />;
      case 'reauth_required':
        return <AlertCircleIcon size={16} className="text-yellow-600 dark:text-yellow-400" />;
    }
  };

  const filteredInstitutions = institutions.filter(inst =>
    inst.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const needsReauth = connections.filter(c => c.status === 'reauth_required').length;

  return (
    <div className="space-y-6">
      {/* Configuration Warning */}
      {!configStatus.plaid && !configStatus.trueLayer && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="text-yellow-600 dark:text-yellow-400 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                Bank connections not configured
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                To enable automatic bank syncing, configure API credentials in the settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Connected Banks
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {connections.length} bank{connections.length !== 1 ? 's' : ''} connected
            {needsReauth > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400 ml-2">
                ({needsReauth} need{needsReauth === 1 ? 's' : ''} reauthorization)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          {connections.length > 0 && (
            <button
              onClick={handleSyncAll}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <RefreshCwIcon size={16} />
              Sync All
            </button>
          )}
          <button
            onClick={() => setShowAddBank(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <PlusIcon size={16} />
            Add Bank
          </button>
        </div>
      </div>

      {/* Connected Banks List */}
      {connections.length > 0 ? (
        <div className="space-y-3">
          {connections.map(connection => (
            <div
              key={connection.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <Building2Icon size={24} className="text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {connection.institutionName}
                      </h4>
                      {getStatusIcon(connection.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <span>{connection.accounts.length} accounts linked</span>
                      {connection.lastSync && (
                        <span className="flex items-center gap-1">
                          <ClockIcon size={12} />
                          Last synced {format(new Date(connection.lastSync), 'MMM d, h:mm a')}
                        </span>
                      )}
                    </div>
                    {connection.error && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {connection.error}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSync(connection.id)}
                    disabled={syncingConnections.has(connection.id)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
                    title="Sync now"
                  >
                    <RefreshCwIcon 
                      size={20} 
                      className={syncingConnections.has(connection.id) ? 'animate-spin' : ''}
                    />
                  </button>
                  <button
                    onClick={() => handleDisconnect(connection.id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    title="Disconnect"
                  >
                    <UnlinkIcon size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center">
          <LinkIcon size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No banks connected
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Connect your bank accounts for automatic transaction imports and real-time balance updates.
          </p>
          <button
            onClick={() => setShowAddBank(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <PlusIcon size={20} />
            Connect Your First Bank
          </button>
        </div>
      )}

      {/* Add Bank Modal */}
      <Modal
        isOpen={showAddBank}
        onClose={() => setShowAddBank(false)}
        title="Connect a Bank"
        size="lg"
      >
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <SearchIcon 
              size={20} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for your bank..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Provider Info */}
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 shadow-md border-l-4 border-amber-400 dark:border-amber-600 text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">Secure Connection:</strong> Your credentials are never stored. 
              Connection is established directly with your bank using OAuth.
            </p>
          </div>

          {/* Institution List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredInstitutions.map(institution => (
              <button
                key={institution.id}
                onClick={() => handleConnect(institution)}
                disabled={isLoading}
                className="w-full p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-left flex items-center gap-4"
              >
                <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center">
                  <Building2Icon size={24} className="text-gray-600 dark:text-gray-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {institution.name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    via {institution.provider === 'truelayer' ? 'TrueLayer' : 'Plaid'}
                  </p>
                </div>
                <LinkIcon size={20} className="text-gray-400" />
              </button>
            ))}
          </div>

          {filteredInstitutions.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No banks found matching "{searchTerm}"
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}