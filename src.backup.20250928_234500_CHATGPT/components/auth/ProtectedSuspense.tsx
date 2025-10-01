import { Suspense, type ReactNode } from 'react';
import { ProtectedRoute } from './ProtectedRoute';
import PageLoader from '../PageLoader';

interface ProtectedSuspenseProps {
  children: ReactNode;
  requirePremium?: boolean | undefined;
  requiredRole?: string | undefined;
  fallbackPath?: string | undefined;
}

// Helper component that combines ProtectedRoute with Suspense
export function ProtectedSuspense({ 
  children, 
  requirePremium,
  requiredRole,
  fallbackPath
}: ProtectedSuspenseProps) {
  return (
    <ProtectedRoute 
      requirePremium={requirePremium}
      requiredRole={requiredRole}
      fallbackPath={fallbackPath}
    >
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ProtectedRoute>
  );
}