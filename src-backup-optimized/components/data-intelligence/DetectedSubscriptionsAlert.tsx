import React from 'react';
import { CheckCircleIcon } from '../icons';
import type { Subscription } from '../../services/dataIntelligenceService';

interface DetectedSubscriptionsAlertProps {
  detectedSubscriptions: Subscription[];
  onReview: () => void;
}

export default function DetectedSubscriptionsAlert({
  detectedSubscriptions,
  onReview
}: DetectedSubscriptionsAlertProps): React.JSX.Element {
  if (detectedSubscriptions.length === 0) {
    return <></>;
  }

  return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <CheckCircleIcon size={20} className="text-green-600 dark:text-green-400" />
        <div className="flex-1">
          <p className="font-medium text-green-900 dark:text-green-100">
            {detectedSubscriptions.length} New Subscription{detectedSubscriptions.length > 1 ? 's' : ''} Detected!
          </p>
          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
            We found recurring payments in your transactions. Review them in the Subscriptions tab.
          </p>
        </div>
        <button
          onClick={onReview}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
        >
          Review
        </button>
      </div>
    </div>
  );
}