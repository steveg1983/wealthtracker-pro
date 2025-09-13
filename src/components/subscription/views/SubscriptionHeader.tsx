/**
 * Subscription Header Component
 * Displays header with title and navigation
 */

import React, { useEffect } from 'react';
import { ArrowLeftIcon } from '../../icons';
import SyncSubscriptionButton from '../SyncSubscriptionButton';
import type { ViewMode } from '../../../services/subscriptionPageService';
import { logger } from '../../../services/loggingService';

interface SubscriptionHeaderProps {
  currentView: ViewMode;
  title: string;
  currentTier: string;
  showBackButton: boolean;
  onBack: () => void;
  onChangeView: (view: ViewMode) => void;
  onSync: () => void;
}

const SubscriptionHeader = React.memo(({
  currentView,
  title,
  currentTier,
  showBackButton,
  onBack,
  onChangeView,
  onSync
}: SubscriptionHeaderProps) => {
  return (
    <div className="mb-8">
      {showBackButton && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300 mb-4"
        >
          <ArrowLeftIcon size={16} />
          Back to Plans
        </button>
      )}
      
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        {title}
      </h1>
      
      {currentView === 'billing' && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-gray-600 dark:text-gray-400">
            Current plan: <span className="font-medium">{currentTier}</span>
          </p>
          <div className="flex items-center gap-4">
            <SyncSubscriptionButton onSync={onSync} />
            <button
              onClick={() => onChangeView('plans')}
              className="text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300"
            >
              Change Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

SubscriptionHeader.displayName = 'SubscriptionHeader';

export default SubscriptionHeader;