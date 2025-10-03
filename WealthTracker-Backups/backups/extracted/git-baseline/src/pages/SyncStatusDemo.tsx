import React, { useState } from 'react';
import SyncStatusIndicator from '../components/SyncStatusIndicator';
import SyncHistoryModal from '../components/sync/SyncHistoryModal';
import ConflictResolutionModal from '../components/sync/ConflictResolutionModal';
import { useSyncStatus } from '../hooks/useSyncStatus';

export default function SyncStatusDemo(): React.JSX.Element {
  const [showHistory, setShowHistory] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const { 
    syncHistory, 
    conflictCount,
    resolveConflict,
    triggerSync,
    status
  } = useSyncStatus();

  // Mock conflicts for demo
  const mockConflicts = conflictCount > 0 ? [
    {
      id: 'conflict-1',
      type: 'transaction' as const,
      localValue: {
        amount: 100,
        description: 'Grocery Store (Local)',
        date: new Date().toISOString()
      },
      remoteValue: {
        amount: 105,
        description: 'Grocery Store (Remote)',
        date: new Date().toISOString()
      },
      timestamp: new Date()
    }
  ] : [];

  const handleResolveAll = async (resolution: 'local' | 'remote'): Promise<void> => {
    for (const conflict of mockConflicts) {
      await resolveConflict(conflict.id, resolution);
    }
  };

  const handleClearHistory = (): void => {
    localStorage.removeItem('syncHistory');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Sync Status Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test the enhanced real-time sync status indicators
          </p>
        </div>

        {/* Sync Status Variants */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Compact Variant */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Compact Variant
            </h2>
            <div className="flex justify-center">
              <SyncStatusIndicator 
                variant="compact"
                onShowHistory={() => setShowHistory(true)}
                onShowConflicts={() => setShowConflicts(true)}
              />
            </div>
          </div>

          {/* Detailed Variant */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Detailed Variant
            </h2>
            <SyncStatusIndicator 
              variant="detailed"
              showLastSync={true}
              onShowHistory={() => setShowHistory(true)}
              onShowConflicts={() => setShowConflicts(true)}
            />
          </div>

          {/* Full Variant */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Full Variant
            </h2>
            <SyncStatusIndicator 
              variant="full"
              showLastSync={true}
              onShowHistory={() => setShowHistory(true)}
              onShowConflicts={() => setShowConflicts(true)}
            />
          </div>
        </div>

        {/* Test Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Test Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => triggerSync()}
              disabled={status === 'syncing'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Trigger Sync
            </button>
            
            <button
              onClick={() => {
                // Simulate data change
                window.dispatchEvent(new CustomEvent('data-changed', {
                  detail: { type: 'transaction', action: 'create' }
                }));
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Simulate Change
            </button>
            
            <button
              onClick={() => setShowHistory(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              View History
            </button>
            
            <button
              onClick={() => setShowConflicts(true)}
              disabled={conflictCount === 0}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              View Conflicts ({conflictCount})
            </button>
          </div>
        </div>

        {/* Sync Statistics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Sync Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {syncHistory.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Total Syncs
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {syncHistory.filter(h => h.status === 'success').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Successful
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {syncHistory.filter(h => h.status === 'failed').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Failed
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">
                {syncHistory.filter(h => h.status === 'partial').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                With Conflicts
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
            How to Test
          </h3>
          <ul className="list-disc list-inside space-y-2 text-blue-800 dark:text-blue-300">
            <li>Click "Trigger Sync" to see the progress animation</li>
            <li>Click "Simulate Change" to add pending changes</li>
            <li>Sync will randomly generate conflicts (20% chance)</li>
            <li>View and resolve conflicts when they appear</li>
            <li>Check sync history to see all past operations</li>
            <li>Try going offline (airplane mode) to see offline state</li>
          </ul>
        </div>
      </div>

      {/* Modals */}
      <SyncHistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        syncHistory={syncHistory}
        onClearHistory={handleClearHistory}
      />
      
      <ConflictResolutionModal
        isOpen={showConflicts}
        onClose={() => setShowConflicts(false)}
        conflicts={mockConflicts}
        onResolve={resolveConflict}
        onResolveAll={handleResolveAll}
      />
    </div>
  );
}