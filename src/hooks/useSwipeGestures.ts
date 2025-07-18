import { useEffect, useRef, useState } from 'react';

interface SwipeGestureOptions {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  enabled?: boolean;
}

interface TouchPosition {
  x: number;
  y: number;
}

export function useSwipeGestures({
  threshold = 50,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  enabled = true
}: SwipeGestureOptions) {
  const [touchStart, setTouchStart] = useState<TouchPosition | null>(null);
  const [touchEnd, setTouchEnd] = useState<TouchPosition | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const minSwipeDistance = threshold;

  const onTouchStart = (e: TouchEvent) => {
    if (!enabled) return;
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!enabled) return;
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const onTouchEnd = () => {
    if (!enabled || !touchStart || !touchEnd) return;
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    const isUpSwipe = distanceY > minSwipeDistance;
    const isDownSwipe = distanceY < -minSwipeDistance;

    // Determine if horizontal or vertical swipe is dominant
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);

    if (isHorizontalSwipe) {
      if (isLeftSwipe && onSwipeLeft) {
        onSwipeLeft();
      } else if (isRightSwipe && onSwipeRight) {
        onSwipeRight();
      }
    } else {
      if (isUpSwipe && onSwipeUp) {
        onSwipeUp();
      } else if (isDownSwipe && onSwipeDown) {
        onSwipeDown();
      }
    }
  };

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: true });
    element.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, touchStart, touchEnd]);

  return elementRef;
}

// Hook for swipe-to-navigate between pages
export function useSwipeNavigation() {
  const pages = [
    '/',
    '/accounts',
    '/investments', 
    '/analytics',
    '/settings'
  ];

  const getCurrentPageIndex = (pathname: string): number => {
    const exactMatch = pages.findIndex(page => page === pathname);
    if (exactMatch !== -1) return exactMatch;
    
    // Find partial match for nested routes
    return pages.findIndex(page => page !== '/' && pathname.startsWith(page));
  };

  const navigateToPage = (direction: 'next' | 'prev', currentPath: string): string | null => {
    const currentIndex = getCurrentPageIndex(currentPath);
    if (currentIndex === -1) return null;

    let nextIndex: number;
    if (direction === 'next') {
      nextIndex = currentIndex === pages.length - 1 ? 0 : currentIndex + 1;
    } else {
      nextIndex = currentIndex === 0 ? pages.length - 1 : currentIndex - 1;
    }

    return pages[nextIndex];
  };

  return { navigateToPage, getCurrentPageIndex };
}