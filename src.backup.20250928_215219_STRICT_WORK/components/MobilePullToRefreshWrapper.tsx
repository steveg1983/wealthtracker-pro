import React, { useCallback } from 'react';
import type { ReactNode } from 'react';
import { PullToRefresh } from './PullToRefresh';
import { useNavigate } from 'react-router-dom';

interface MobilePullToRefreshWrapperProps {
  children: ReactNode;
  onRefresh?: () => Promise<void>;
  enabled?: boolean;
}

export function MobilePullToRefreshWrapper({
  children,
  onRefresh,
  enabled = true
}: MobilePullToRefreshWrapperProps): React.JSX.Element {
  const navigate = useNavigate();
  const isMobile = window.innerWidth < 768; // Only enable on mobile devices

  const defaultRefresh = useCallback(async () => {
    // Default refresh behavior - reload the current page
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    window.location.reload();
  }, []);

  const handleRefresh = onRefresh || defaultRefresh;

  // Only wrap in PullToRefresh on mobile devices
  if (isMobile && enabled) {
    return (
      <PullToRefresh onRefresh={handleRefresh}>
        {children}
      </PullToRefresh>
    );
  }

  // On desktop, just render children as-is
  return <>{children}</>;
}