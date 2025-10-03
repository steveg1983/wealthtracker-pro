import React, { useRef, useState, useCallback, useEffect } from 'react';
import { RefreshCwIcon, ChevronDownIcon } from './icons';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  maxPullDistance?: number;
  refreshingText?: string;
  pullText?: string;
  releaseText?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Pull-to-Refresh Component
 * Native iOS/Android style pull-to-refresh for web
 */
export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  maxPullDistance = 120,
  refreshingText = 'Refreshing...',
  pullText = 'Pull to refresh',
  releaseText = 'Release to refresh',
  disabled = false,
  className = ''
}: PullToRefreshProps): React.JSX.Element {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const startTime = useRef(0);

  // Check if we can pull to refresh (at top of scroll)
  const checkCanPull = useCallback(() => {
    if (!containerRef.current || disabled) return false;
    
    const scrollTop = containerRef.current.scrollTop;
    return scrollTop === 0;
  }, [disabled]);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!checkCanPull() || isRefreshing) return;
    
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    startTime.current = Date.now();
    setCanRefresh(true);
  }, [checkCanPull, isRefreshing]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!canRefresh || isRefreshing) return;
    
    currentY.current = e.touches[0].clientY;
    const deltaY = currentY.current - startY.current;
    
    // Only allow pulling down
    if (deltaY > 0) {
      setIsDragging(true);
      
      // Apply resistance - gets harder to pull as distance increases
      const resistance = Math.max(0.3, 1 - (deltaY / maxPullDistance) * 0.7);
      const adjustedDistance = Math.min(deltaY * resistance, maxPullDistance);
      
      setPullDistance(adjustedDistance);
      
      // Prevent default scrolling behavior while pulling
      if (adjustedDistance > 10) {
        e.preventDefault();
      }
    }
  }, [canRefresh, isRefreshing, maxPullDistance]);

  // Handle touch end
  const handleTouchEnd = useCallback(async () => {
    if (!canRefresh || isRefreshing) return;
    
    setIsDragging(false);
    setCanRefresh(false);
    
    // If pulled past threshold, trigger refresh
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Animate back to 0
      setPullDistance(0);
    }
  }, [canRefresh, isRefreshing, pullDistance, threshold, onRefresh]);

  // Handle mouse events for desktop testing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!checkCanPull() || isRefreshing) return;
    
    startY.current = e.clientY;
    currentY.current = startY.current;
    setCanRefresh(true);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      currentY.current = moveEvent.clientY;
      const deltaY = currentY.current - startY.current;
      
      if (deltaY > 0) {
        setIsDragging(true);
        const resistance = Math.max(0.3, 1 - (deltaY / maxPullDistance) * 0.7);
        const adjustedDistance = Math.min(deltaY * resistance, maxPullDistance);
        setPullDistance(adjustedDistance);
      }
    };
    
    const handleMouseUp = async () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      setIsDragging(false);
      setCanRefresh(false);
      
      if (pullDistance >= threshold) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } catch (error) {
          console.error('Refresh failed:', error);
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [checkCanPull, isRefreshing, pullDistance, threshold, maxPullDistance, onRefresh]);

  // Calculate indicator state
  const progress = Math.min(pullDistance / threshold, 1);
  const showIndicator = pullDistance > 0 || isRefreshing;
  const shouldRelease = pullDistance >= threshold && !isRefreshing;

  // Get indicator text
  const getIndicatorText = () => {
    if (isRefreshing) return refreshingText;
    if (shouldRelease) return releaseText;
    return pullText;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setPullDistance(0);
      setIsRefreshing(false);
      setCanRefresh(false);
      setIsDragging(false);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-y-auto overflow-x-hidden ${className}`}
      style={{
        transform: `translateY(${isDragging ? pullDistance * 0.5 : 0}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      {/* Pull indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex flex-col items-center justify-center z-10"
        style={{
          height: Math.max(pullDistance, isRefreshing ? 60 : 0),
          transform: `translateY(${isRefreshing ? 0 : -60 + pullDistance}px)`,
          transition: isRefreshing ? 'transform 0.3s ease' : isDragging ? 'none' : 'all 0.3s ease'
        }}
      >
        {showIndicator && (
          <>
            {/* Icon */}
            <div className="flex items-center justify-center mb-2">
              {isRefreshing ? (
                <RefreshCwIcon 
                  size={24} 
                  className="text-blue-500 animate-spin" 
                />
              ) : (
                <ChevronDownIcon 
                  size={24} 
                  className={`text-gray-600 dark:text-gray-400 transition-transform duration-200 ${
                    shouldRelease ? 'rotate-180' : ''
                  }`}
                  style={{
                    transform: `rotate(${shouldRelease ? 180 : progress * 180}deg)`
                  }}
                />
              )}
            </div>
            
            {/* Text */}
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              {getIndicatorText()}
            </p>
            
            {/* Progress circle */}
            <div className="mt-2 relative">
              <svg 
                width="20" 
                height="20" 
                className="transform -rotate-90"
              >
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="text-gray-300 dark:text-gray-600"
                />
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 8}`}
                  strokeDashoffset={`${2 * Math.PI * 8 * (1 - progress)}`}
                  className={`transition-all duration-200 ${
                    shouldRelease ? 'text-green-500' : 'text-blue-500'
                  }`}
                />
              </svg>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          paddingTop: isRefreshing ? 60 : 0,
          transition: 'padding-top 0.3s ease'
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Hook for pull-to-refresh functionality
 */
export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  options: {
    threshold?: number;
    disabled?: boolean;
  } = {}
) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  
  const refresh = useCallback(async () => {
    if (isRefreshing || options.disabled) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Refresh failed:', error);
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing, options.disabled]);

  return {
    isRefreshing,
    lastRefresh,
    refresh
  };
}

/**
 * Enhanced List with Pull-to-Refresh
 */
export function RefreshableList({
  onRefresh,
  children,
  isEmpty = false,
  emptyMessage = 'No items to show',
  emptyAction,
  className = ''
}: {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  className?: string;
}) {
  return (
    <PullToRefresh onRefresh={onRefresh} className={className}>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
              {emptyMessage}
            </p>
            {emptyAction}
          </div>
        </div>
      ) : (
        children
      )}
    </PullToRefresh>
  );
}