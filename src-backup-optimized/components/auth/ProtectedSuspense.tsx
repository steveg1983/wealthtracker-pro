import React, { Suspense } from 'react';
import { PageLoader } from '../PageLoader';

interface ProtectedSuspenseProps {
  children: React.ReactNode;
  requirePremium?: boolean;
}

export const ProtectedSuspense: React.FC<ProtectedSuspenseProps> = ({ children }) => {
  return (
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  );
};