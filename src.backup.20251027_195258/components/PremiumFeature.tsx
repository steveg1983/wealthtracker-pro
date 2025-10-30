import React from 'react';
import { useSubscription } from '../hooks/useSubscription';

interface PremiumFeatureProps {
  feature: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PremiumFeature({ feature, fallback, children }: PremiumFeatureProps): React.ReactElement {
  const { hasFeatureAccess } = useSubscription();

  if (!hasFeatureAccess(feature)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This feature requires a premium subscription
        </p>
        <a
          href="/subscription"
          className="text-gray-600 dark:text-gray-500 hover:underline text-sm"
        >
          Upgrade Now
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
