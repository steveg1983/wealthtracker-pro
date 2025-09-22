import type { ReactNode } from 'react';

interface MobilePullToRefreshWrapperProps {
  children: ReactNode;
  onRefresh?: () => Promise<void>;
}

function MobilePullToRefreshWrapper({
  children,
  onRefresh
}: MobilePullToRefreshWrapperProps) {
  return (
    <div className="relative">
      {children}
    </div>
  );
}

export { MobilePullToRefreshWrapper };
export default MobilePullToRefreshWrapper;