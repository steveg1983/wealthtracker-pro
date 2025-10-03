import { useCallback, useEffect, useRef, useState } from 'react';

interface SwipeNavOptions {
  minSwipeDistance?: number;
  edgeThreshold?: number;
}

export function useSwipeToOpenNav({
  minSwipeDistance = 50,
  edgeThreshold = 20
}: SwipeNavOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    touchEndRef.current = null;
    touchStartRef.current = event.targetTouches[0]?.clientX ?? null;
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    touchEndRef.current = event.targetTouches[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartRef.current === null || touchEndRef.current === null) {
      return;
    }

    const distance = touchEndRef.current - touchStartRef.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isEdgeSwipe = touchStartRef.current < edgeThreshold;

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

  return { isOpen, setIsOpen } as const;
}
