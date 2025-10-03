import React, { useState, useEffect } from 'react';
import { bankConnectionService, type BankConnection } from '../../services/bankConnectionService';
import { Building2Icon, RefreshCwIcon, CheckCircleIcon, AlertCircleIcon, LinkIcon } from '../icons';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface BankConnectionsWidgetProps {
  size: 'small' | 'medium' | 'large';
  settings: Record<string, any>;
}

export default function BankConnectionsWidget({ size, settings }: BankConnectionsWidgetProps) {
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadConnections();
    
    // Check for connections needing reauth
    const needsReauth = bankConnectionService.needsReauth();
    if (needsReauth.length > 0) {
      // Could show a notification here
    }
  }, []);

  const loadConnections = () => {
    setConnections(bankConnectionService.getConnections());
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      await bankConnectionService.syncAll();
      loadConnections();
    } finally {
      setIsSyncing(false);
    }
  };

  const connectedCount = connections.filter(c => c.status === 'connected').length;
  const errorCount = connections.filter(c => c.status === 'error' || c.status === 'reauth_required').length;

  const getStatusColor = (status: BankConnection['status']) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'reauth_required':
        return 'text-yellow-600 dark:text-yellow-400';
    }
  };

  if (size === 'small') {
    return (
      <div className="h-full flex flex-col">
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {connections.length}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Banks Connected
          </p>
          {errorCount > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {errorCount} need attention
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Bank Connections
        </h3>
        <button
          onClick={handleSyncAll}
          disabled={isSyncing || connections.length === 0}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
          title="Sync all banks"
        >
          <RefreshCwIcon size={16} className={isSyncing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {connections.length > 0 ? (
          <div className="space-y-3">
            {connections.slice(0, size === 'medium' ? 3 : 5).map(connection => (
              <div
                key={connection.id}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center">
                  <Building2Icon size={20} className="text-gray-600 dark:text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {connection.institutionName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {connection.accounts.length} accounts • 
                    {connection.lastSync && (
                      <span> Last sync {format(new Date(connection.lastSync), 'MMM d')}</span>
                    )}
                  </p>
                </div>
                <div className={getStatusColor(connection.status)}>
                  {connection.status === 'connected' ? (
                    <CheckCircleIcon size={16} />
                  ) : (
                    <AlertCircleIcon size={16} />
                  )}
                </div>
              </div>
            ))}
            
            {connections.length > (size === 'medium' ? 3 : 5) && (
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                +{connections.length - (size === 'medium' ? 3 : 5)} more
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <LinkIcon size={32} className="text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              No banks connected
            </p>
            <button
              onClick={() => navigate('/settings/data')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Connect a bank
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      {connections.length > 0 && (
        <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => navigate('/settings/data')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Manage connections →
          </button>
        </div>
      )}
    </div>
  );
}