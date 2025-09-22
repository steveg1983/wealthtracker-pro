/**
 * Loading View Component
 * Shows loading spinner and message
 */

import React, { useEffect } from 'react';
import { useLogger } from '../services/ServiceProvider';

interface LoadingViewProps {
  message?: string;
}

const LoadingView = React.memo(({ message = 'Loading subscription information...' }: LoadingViewProps) => {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
});

LoadingView.displayName = 'LoadingView';

export default LoadingView;