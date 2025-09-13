/**
 * Subscription Modal Component
 * Modal for adding/editing subscriptions
 */

import React, { useEffect } from 'react';
import type { Subscription } from '../../services/dataIntelligenceService';
import { logger } from '../../services/loggingService';

interface SubscriptionModalProps {
  isOpen: boolean;
  subscription: Subscription | null;
  onClose: () => void;
  onSave?: (subscription: Omit<Subscription, 'id' | 'createdAt' | 'lastUpdated'>) => void;
  onUpdate?: (id: string, updates: Partial<Subscription>) => void;
}

const SubscriptionModal = React.memo(({
  isOpen,
  subscription,
  onClose,
  onSave,
  onUpdate
}: SubscriptionModalProps) => {
  if (!isOpen) return null;

  const isEditing = !!subscription;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {isEditing ? 'Edit Subscription' : 'Add Subscription'}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Subscription management modal would be implemented here.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
});

SubscriptionModal.displayName = 'SubscriptionModal';

export default SubscriptionModal;