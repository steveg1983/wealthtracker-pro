import { Suspense, ReactNode } from 'react';
import ProtectedRoute from './ProtectedRoute';
import PageLoader from './PageLoader';

interface ProtectedSuspenseProps {
  children: ReactNode;
  requirePremium?: boolean;
  fallbackPath?: string;
}

// Helper component that combines ProtectedRoute with Suspense
export function ProtectedSuspense({
  children,
  requirePremium,
  fallbackPath
}: ProtectedSuspenseProps) {
  return (
    <ProtectedRoute
      requirePremium={requirePremium}
      fallbackPath={fallbackPath}
    >
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ProtectedRoute>
  );
}
