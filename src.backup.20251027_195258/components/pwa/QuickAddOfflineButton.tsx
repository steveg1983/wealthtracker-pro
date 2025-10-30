/**
 * Quick Add Offline Button
 * Floating action button for quickly adding transactions while offline
 */

import React from 'react';
import { useOfflineState } from '../../pwa/offline-storage';
import { OfflineTransactionForm } from './OfflineTransactionForm';
import { PlusCircleIcon, WifiOffIcon } from '../icons';
import { logger } from '../../services/loggingService';

export const QuickAddOfflineButton: React.FC = () => {
  const offlineState = useOfflineState();
  const [showForm, setShowForm] = React.useState(false);
  
  // Only show when offline or when there are pending changes
  if (!offlineState.isOffline && offlineState.pendingChanges === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-20 right-4 z-40 bg-gray-600 hover:bg-gray-700 text-white rounded-full p-4 shadow-lg transition-all transform hover:scale-110"
        title="Add transaction (offline)"
      >
        <div className="relative">
          <PlusCircleIcon className="h-6 w-6" />
          {offlineState.isOffline && (
            <WifiOffIcon className="absolute -top-2 -right-2 h-4 w-4 text-orange-400" />
          )}
        </div>
      </button>

      <OfflineTransactionForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          // Could show a toast notification here
          logger.info('Transaction queued for sync');
        }}
      />
    </>
  );
};
