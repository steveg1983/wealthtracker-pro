/**
 * Conflict Resolution Modal
 * UI for resolving sync conflicts between local and server data
 */

import React from 'react';
import { useOfflineOperations, type OfflineQueueItem } from '../../pwa/offline-storage';
import { Modal } from '../common/Modal';
import { AlertTriangleIcon, CheckIcon } from '../icons';
import { formatCurrency } from '../../utils/formatters';
import { format } from 'date-fns';
import { logger } from '../../services/loggingService';

type ConflictRecord = Record<string, unknown>;

interface ConflictDetails {
  id: string;
  entity: OfflineQueueItem['entity'];
  clientData: ConflictRecord;
  serverData: ConflictRecord;
}

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: ConflictDetails | null;
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toStringValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
};

const formatDateValue = (value: unknown): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return format(value, 'PP');
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return format(parsed, 'PP');
    }
  }

  return 'Unknown date';
};

const ensureRecord = (value: ConflictRecord | unknown): ConflictRecord => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as ConflictRecord;
  }
  return {};
};

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  conflict
}) => {
  const { resolveConflict } = useOfflineOperations();
  const [selectedResolution, setSelectedResolution] = React.useState<'client' | 'server'>('server');
  const [isResolving, setIsResolving] = React.useState(false);

  if (!conflict) return null;

  const handleResolve = async () => {
    setIsResolving(true);
    
    try {
      const resolvedData = selectedResolution === 'client'
        ? conflict.clientData
        : conflict.serverData;

      await resolveConflict(conflict.id, resolvedData);
      onClose();
    } catch (error) {
      logger.error('Failed to resolve conflict:', error);
    } finally {
      setIsResolving(false);
    }
  };

  const renderConflictDetails = () => {
    switch (conflict.entity) {
      case 'transaction':
        return renderTransactionConflict();
      case 'account':
        return renderAccountConflict();
      case 'budget':
        return renderBudgetConflict();
      default:
        return renderGenericConflict();
    }
  };

  const renderTransactionConflict = () => {
    const client = ensureRecord(conflict.clientData);
    const server = ensureRecord(conflict.serverData);
    const clientAmount = toNumber(client.amount);
    const serverAmount = toNumber(server.amount);
    const clientDescription = toStringValue(client.description);
    const serverDescription = toStringValue(server.description);
    const clientCategory = toStringValue(client.category);
    const serverCategory = toStringValue(server.category);
    const clientDate = formatDateValue(client.date);
    const serverDate = formatDateValue(server.date);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Local Version */}
          <div className="border rounded-lg p-4 dark:border-gray-700">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-500">Your Version</span>
              {selectedResolution === 'client' && (
                <CheckIcon className="h-4 w-4 text-green-500" />
              )}
            </h4>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500">Amount:</span> {formatCurrency(clientAmount)}</p>
              <p><span className="text-gray-500">Description:</span> {clientDescription}</p>
              <p><span className="text-gray-500">Date:</span> {clientDate}</p>
              <p><span className="text-gray-500">Category:</span> {clientCategory}</p>
            </div>
            <button
              onClick={() => setSelectedResolution('client')}
              className={`mt-3 w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                selectedResolution === 'client'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              Use This Version
            </button>
          </div>

          {/* Server Version */}
          <div className="border rounded-lg p-4 dark:border-gray-700">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <span className="text-green-600 dark:text-green-400">Server Version</span>
              {selectedResolution === 'server' && (
                <CheckIcon className="h-4 w-4 text-green-500" />
              )}
            </h4>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500">Amount:</span> {formatCurrency(serverAmount)}</p>
              <p><span className="text-gray-500">Description:</span> {serverDescription}</p>
              <p><span className="text-gray-500">Date:</span> {serverDate}</p>
              <p><span className="text-gray-500">Category:</span> {serverCategory}</p>
            </div>
            <button
              onClick={() => setSelectedResolution('server')}
              className={`mt-3 w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                selectedResolution === 'server'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              Use This Version
            </button>
          </div>
        </div>

        {/* Differences */}
        {renderDifferences(client, server)}
      </div>
    );
  };

  const renderAccountConflict = () => {
    const client = ensureRecord(conflict.clientData);
    const server = ensureRecord(conflict.serverData);
    const clientBalance = toNumber(client.balance);
    const serverBalance = toNumber(server.balance);

    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Account balance conflict detected. This usually happens when transactions were added both online and offline.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Your Balance</p>
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-500">
              {formatCurrency(clientBalance)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Server Balance</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(serverBalance)}
            </p>
          </div>
        </div>

        <div className="border-t pt-4 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Difference: {formatCurrency(Math.abs(clientBalance - serverBalance))}
          </p>
          <p className="text-xs text-gray-500">
            Consider reviewing recent transactions to ensure all are accounted for.
          </p>
        </div>
      </div>
    );
  };

  const renderBudgetConflict = () => {
    const client = ensureRecord(conflict.clientData);
    const server = ensureRecord(conflict.serverData);
    const clientAmount = toNumber(client.amount);
    const serverAmount = toNumber(server.amount);
    const clientSpent = toNumber(client.spent);
    const serverSpent = toNumber(server.spent);

    return (
      <div className="space-y-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="text-left py-2">Field</th>
              <th className="text-center py-2">Your Version</th>
              <th className="text-center py-2">Server Version</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2">Budget Amount</td>
              <td className="text-center">{formatCurrency(clientAmount)}</td>
              <td className="text-center">{formatCurrency(serverAmount)}</td>
            </tr>
            <tr className="border-b dark:border-gray-700">
              <td className="py-2">Spent</td>
              <td className="text-center">{formatCurrency(clientSpent)}</td>
              <td className="text-center">{formatCurrency(serverSpent)}</td>
            </tr>
            <tr>
              <td className="py-2">Remaining</td>
              <td className="text-center">
                {formatCurrency(clientAmount - clientSpent)}
              </td>
              <td className="text-center">
                {formatCurrency(serverAmount - serverSpent)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderGenericConflict = () => {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-sm mb-2">Your Version</h4>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(conflict.clientData, null, 2)}
            </pre>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-2">Server Version</h4>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(conflict.serverData, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  const renderDifferences = (client: ConflictRecord, server: ConflictRecord) => {
    const keys = new Set([...Object.keys(client), ...Object.keys(server)]);
    const differences = Array.from(keys).filter((key) => !Object.is(client[key], server[key]));

    if (differences.length === 0) return null;
    
    return (
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Conflicting fields:
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {differences.join(', ')}
        </p>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Resolve Sync Conflict"
    >
      <div className="space-y-6">
        {/* Warning Header */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <AlertTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-amber-900 dark:text-amber-100">
              Data Conflict Detected
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              This {conflict.entity} was modified both offline and online. Please choose which version to keep.
            </p>
          </div>
        </div>

        {/* Conflict Details */}
        {renderConflictDetails()}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={isResolving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleResolve}
            disabled={isResolving}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResolving ? 'Resolving...' : 'Apply Resolution'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
