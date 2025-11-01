import React from 'react';

interface SwipeToOpenNavState {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useSwipeToOpenNav = (options: { edgeThreshold?: number; minDistance?: number } = {}): SwipeToOpenNavState => {
  const { edgeThreshold = 20, minDistance = 50 } = options;
  const [isOpen, setIsOpen] = React.useState(false);
  const touchStartRef = React.useRef<number | null>(null);
  const touchEndRef = React.useRef<number | null>(null);

  const handleTouchStart = React.useCallback((event: TouchEvent) => {
    touchEndRef.current = null;
    touchStartRef.current = event.targetTouches[0]?.clientX ?? null;
  }, []);

  const handleTouchMove = React.useCallback((event: TouchEvent) => {
    touchEndRef.current = event.targetTouches[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = React.useCallback(() => {
    const touchStart = touchStartRef.current;
    const touchEnd = touchEndRef.current;

    if (touchStart === null || touchEnd === null) {
      return;
    }

    const distance = touchEnd - touchStart;
    const isSwipeFromEdge = touchStart <= edgeThreshold;
    const isSufficientDistance = distance >= minDistance;

    if (isSwipeFromEdge && isSufficientDistance) {
      setIsOpen(true);
    }
  }, [edgeThreshold, minDistance]);

  React.useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { isOpen, setIsOpen };
};
