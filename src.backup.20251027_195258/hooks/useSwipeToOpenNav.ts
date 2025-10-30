/**
 * Swipe to open navigation hook
 * Detects left-edge swipe gestures to open mobile navigation
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface SwipeOptions {
  minSwipeDistance?: number;
  edgeThreshold?: number;
}

export function useSwipeToOpenNav(options: SwipeOptions = {}) {
  const { minSwipeDistance = 50, edgeThreshold = 20 } = options;
  const [isOpen, setIsOpen] = useState(false);
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    touchEndRef.current = null;
    const touch = event.targetTouches[0];
    if (touch) {
      touchStartRef.current = touch.clientX;
    }
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    const touch = event.targetTouches[0];
    if (touch) {
      touchEndRef.current = touch.clientX;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const touchStart = touchStartRef.current;
    const touchEnd = touchEndRef.current;

    if (touchStart == null || touchEnd == null) {
      return;
    }

    const distance = touchEnd - touchStart;
    const isLeftSwipe = distance > minSwipeDistance;
    const isEdgeSwipe = touchStart < edgeThreshold;

    if (isLeftSwipe && isEdgeSwipe) {
      setIsOpen(true);
    }
  }, [edgeThreshold, minSwipeDistance]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchEnd, handleTouchMove, handleTouchStart]);

  return { isOpen, setIsOpen };
}
