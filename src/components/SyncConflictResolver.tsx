import React, { useCallback, useEffect, useState } from 'react';
import { offlineService } from '../services/offlineService';
import { AlertCircleIcon, CheckIcon, XIcon } from './icons';
import { formatCurrency } from '../utils/formatters';
import { Button } from './common/Button';
import type { Transaction } from '../types';

const KNOWN_CONFLICT_ENTITIES = ['transaction', 'account', 'budget', 'goal'] as const;
type KnownConflictEntity = typeof KNOWN_CONFLICT_ENTITIES[number];
type ConflictEntity = KnownConflictEntity | 'unknown';

interface Conflict {
  id: string;
  entity: ConflictEntity;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown> | null;
  timestamp: number;
  resolved: boolean;
}

type ConflictResolution = 'local' | 'server';

type TransactionLike = Partial<Pick<Transaction, 'description' | 'amount' | 'date' | 'category'>>;

type TransactionConflict = Conflict & {
  entity: 'transaction';
  localData: Record<string, unknown>;
  serverData: Record<string, unknown> | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toTransactionLike = (data: Record<string, unknown> | null | undefined): TransactionLike | null => {
  if (!data) {
    return null;
  }

  const next: TransactionLike = {};

  if (typeof data.description === 'string') {
    next.description = data.description;
  }
  if (typeof data.amount === 'number') {
    next.amount = data.amount;
  }
  if (typeof data.date === 'string' || data.date instanceof Date) {
    next.date = data.date;
  }
  if (typeof data.category === 'string') {
    next.category = data.category;
  }

  return Object.keys(next).length > 0 ? next : null;
};

const normalizeConflict = (raw: unknown): Conflict | null => {
  if (!isRecord(raw)) {
    return null;
  }

  const { id, entity, localData, serverData, timestamp, resolved } = raw as Record<string, unknown>;

  if (typeof id !== 'string' || typeof timestamp !== 'number') {
    return null;
  }

  const normalizedEntity: ConflictEntity =
    typeof entity === 'string' && KNOWN_CONFLICT_ENTITIES.includes(entity as KnownConflictEntity)
      ? (entity as KnownConflictEntity)
      : 'unknown';

  return {
    id,
    entity: normalizedEntity,
    localData: isRecord(localData) ? localData : {},
    serverData: isRecord(serverData) ? serverData : null,
    timestamp,
    resolved: Boolean(resolved)
  };
};

const isTransactionConflict = (conflict: Conflict): conflict is TransactionConflict =>
  conflict.entity === 'transaction';

const formatTransactionDate = (value: TransactionLike['date']): string | null => {
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
  }
  return null;
};

export function SyncConflictResolver(): React.JSX.Element | null {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const loadConflicts = useCallback(async () => {
    const unresolved: unknown[] = await offlineService.getConflicts();
    const normalized = unresolved
      .map(normalizeConflict)
      .filter((conflict): conflict is Conflict => Boolean(conflict) && !conflict.resolved);

    setConflicts(normalized);
    setSelectedConflict(current =>
      current ? normalized.find(conflict => conflict.id === current.id) ?? null : null
    );
  }, []);

  const resolveConflict = useCallback(async (conflictId: string, resolution: ConflictResolution) => {
    const shouldCloseAfterResolve = conflicts.length <= 1;
    await offlineService.resolveConflict(conflictId, resolution);
    await loadConflicts();
    setSelectedConflict(null);

    if (shouldCloseAfterResolve) {
      setIsOpen(false);
    }
  }, [conflicts.length, loadConflicts]);

  useEffect(() => {
    void loadConflicts();

    const handleNewConflict = () => {
      void loadConflicts();
      setIsOpen(true);
    };

    window.addEventListener('offline-sync-conflict', handleNewConflict);
    return () => {
      window.removeEventListener('offline-sync-conflict', handleNewConflict);
    };
  }, [loadConflicts]);

  if (conflicts.length === 0) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 bg-red-500 text-white p-3 rounded-full shadow-lg hover:bg-red-600 transition-colors"
        aria-label="Resolve sync conflicts"
      >
        <AlertCircleIcon className="h-6 w-6" />
        {conflicts.length > 1 && (
          <span className="absolute -top-1 -right-1 bg-white text-red-500 text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {conflicts.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Sync Conflicts
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} need{conflicts.length === 1 ? 's' : ''} resolution
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <XIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
          {selectedConflict ? (
            <ConflictDetail
              conflict={selectedConflict}
              onResolve={resolveConflict}
              onBack={() => setSelectedConflict(null)}
            />
          ) : (
            <div className="space-y-3">
              {conflicts.map((conflict) => (
                <button
                  key={conflict.id}
                  onClick={() => setSelectedConflict(conflict)}
                  className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white capitalize">
                        {conflict.entity} Conflict
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(conflict.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <AlertCircleIcon className="h-5 w-5 text-red-500" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ConflictDetailProps {
  conflict: Conflict;
  onResolve: (conflictId: string, resolution: ConflictResolution) => void;
  onBack: () => void;
}

function ConflictDetail({ conflict, onResolve, onBack }: ConflictDetailProps): React.JSX.Element {
  const renderTransactionConflict = (transactionConflict: TransactionConflict) => {
    const local = toTransactionLike(transactionConflict.localData);
    const server = toTransactionLike(transactionConflict.serverData);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-blue-500">Local Version</span>
              <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                Your Changes
              </span>
            </h3>
            <TransactionPreview transaction={local} />
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-green-500">Server Version</span>
              <span className="text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                Latest from Server
              </span>
            </h3>
            <TransactionPreview transaction={server} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onBack}>
            Back to List
          </Button>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => onResolve(transactionConflict.id, 'server')}
              leftIcon={CheckIcon}
            >
              Use Server Version
            </Button>
            <Button
              variant="primary"
              onClick={() => onResolve(transactionConflict.id, 'local')}
              leftIcon={CheckIcon}
            >
              Keep My Version
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (isTransactionConflict(conflict)) {
    return renderTransactionConflict(conflict);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Conflict resolution for <span className="font-medium">{conflict.entity}</span> records is not yet supported.
      </p>
      <div className="flex items-center justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button variant="ghost" onClick={onBack}>
          Back to List
        </Button>
      </div>
    </div>
  );
}

interface TransactionPreviewProps {
  transaction: TransactionLike | null;
}

function TransactionPreview({ transaction }: TransactionPreviewProps): React.JSX.Element {
  if (!transaction) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400 text-center italic">
          No data available
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
      <div>
        <span className="text-sm text-gray-600 dark:text-gray-400">Description:</span>
        <p className="font-medium text-gray-900 dark:text-white">
          {transaction.description ?? '—'}
        </p>
      </div>
      <div>
        <span className="text-sm text-gray-600 dark:text-gray-400">Amount:</span>
        <p className="font-medium text-gray-900 dark:text-white">
          {typeof transaction.amount === 'number' ? formatCurrency(transaction.amount) : '—'}
        </p>
      </div>
      <div>
        <span className="text-sm text-gray-600 dark:text-gray-400">Date:</span>
        <p className="font-medium text-gray-900 dark:text-white">
          {formatTransactionDate(transaction.date) ?? '—'}
        </p>
      </div>
      {transaction.category && (
        <div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Category:</span>
          <p className="font-medium text-gray-900 dark:text-white">{transaction.category}</p>
        </div>
      )}
    </div>
  );
}
