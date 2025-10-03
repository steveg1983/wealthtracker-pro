/**
 * Success View Component
 * Displays subscription activation success
 */

import React, { useEffect } from 'react';
import { CheckCircleIcon } from '../../icons';
import { useLogger } from '../services/ServiceProvider';

interface SuccessViewProps {
  planName: string;
  onGoToDashboard: () => void;
  onGoToBilling: () => void;
  features: string[];
}

const SuccessView = React.memo(({
  planName,
  onGoToDashboard,
  onGoToBilling,
  features
}: SuccessViewProps) => {
  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircleIcon size={32} className="text-green-600" />
      </div>
      
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Subscription Activated!
      </h2>
      
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Welcome to {planName}! Your subscription is now active and you have access 
        to all premium features. You're currently in your 14-day free trial period.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button
          onClick={onGoToDashboard}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Go to Dashboard
        </button>
        
        <button
          onClick={onGoToBilling}
          className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Manage Billing
        </button>
      </div>

      {/* Features Preview */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6 shadow-md border-l-4 border-amber-400 dark:border-amber-600">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          What's Next?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {features.slice(0, 4).map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <CheckCircleIcon size={16} />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

SuccessView.displayName = 'SuccessView';

export default SuccessView;