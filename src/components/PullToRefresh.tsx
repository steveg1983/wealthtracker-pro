import React, { useRef, useState, useCallback, ReactNode } from 'react';
import { RefreshCwIcon } from './icons';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  threshold?: number;
  disabled?: boolean;
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  disabled = false
}: PullToRefreshProps): React.JSX.Element {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const touch = e.touches[0];
    startY.current = touch.clientY;
    
    // Only enable pull-to-refresh if at the top of the scrollable area
    const scrollTop = containerRef.current?.scrollTop || 0;
    if (scrollTop === 0) {
      setIsPulling(true);
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || disabled || isRefreshing) return;
    
    const touch = e.touches[0];
    currentY.current = touch.clientY;
    const deltaY = currentY.current - startY.current;
    
    if (deltaY > 0) {
      // Apply resistance as user pulls down
      const resistance = deltaY > threshold ? 0.3 : 1;
      const adjustedDelta = deltaY * resistance;
      
      setPullDistance(Math.min(adjustedDelta, threshold * 1.5));
      
      // Prevent default to stop page scroll when pulling
      if (deltaY > 10) {
        e.preventDefault();
      }
    }
  }, [isPulling, disabled, isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled || isRefreshing) return;
    
    setIsPulling(false);
    
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, disabled, isRefreshing, onRefresh]);

  const indicatorStyle = {
    transform: `translateY(${pullDistance}px) rotate(${pullDistance * 3}deg)`,
    opacity: Math.min(pullDistance / threshold, 1)
  };

  return (
    <div
      ref={containerRef}
      className="pull-to-refresh relative h-full overflow-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-10"
        style={{ height: `${pullDistance}px` }}
      >
        <div
          className={`flex items-center justify-center w-10 h-10 bg-white dark:bg-gray-800 rounded-full shadow-lg transition-transform ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          style={indicatorStyle}
        >
          <RefreshCwIcon 
            size={20} 
            className={`${
              pullDistance >= threshold 
                ? 'text-primary dark:text-blue-400' 
                : 'text-gray-400 dark:text-gray-600'
            }`}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: isPulling || isRefreshing ? `translateY(${pullDistance}px)` : 'none',
          transition: isPulling ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {children}
      </div>

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {isRefreshing ? 'Refreshing data...' : ''}
      </div>
    </div>
  );
}