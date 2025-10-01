import { useRef, useEffect, useCallback } from 'react';

interface TouchGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  onPinch?: (scale: number) => void;
  threshold?: number;
  longPressDelay?: number;
  enabled?: boolean;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export function useTouchGestures<T extends HTMLElement>(
  options: TouchGestureOptions
) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    onLongPress,
    onPinch,
    threshold = 50,
    longPressDelay = 500,
    enabled = true
  } = options;

  const ref = useRef<T>(null);
  const touchStart = useRef<TouchPoint | null>(null);
  const lastTap = useRef<number>(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const initialPinchDistance = useRef<number>(0);

  // Calculate distance between two touch points
  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    const touch = e.touches[0];
    if (!touch) {
      return;
    }
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };

    // Handle pinch gesture start
    if (e.touches.length === 2 && onPinch) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      if (touch1 && touch2) {
        initialPinchDistance.current = getDistance(touch1, touch2);
      }
    }

    // Start long press timer
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        onLongPress();
        touchStart.current = null; // Prevent other gestures
      }, longPressDelay);
    }
  }, [enabled, onLongPress, onPinch, longPressDelay]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    // Cancel long press on move
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Handle pinch gesture
    if (e.touches.length === 2 && onPinch && initialPinchDistance.current > 0) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      if (touch1 && touch2) {
        const currentDistance = getDistance(touch1, touch2);
        const scale = currentDistance / initialPinchDistance.current;
        onPinch(scale);
      }
    }
  }, [enabled, onPinch]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!enabled || !touchStart.current) return;

    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Reset pinch distance
    if (e.touches.length < 2) {
      initialPinchDistance.current = 0;
    }

    const touchEnd = e.changedTouches[0];
    if (!touchEnd) {
      touchStart.current = null;
      return;
    }
    const deltaX = touchEnd.clientX - touchStart.current.x;
    const deltaY = touchEnd.clientY - touchStart.current.y;
    const deltaTime = Date.now() - touchStart.current.time;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Determine if it's a tap
    if (absX < 10 && absY < 10 && deltaTime < 200) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTap.current;

      if (onDoubleTap && timeSinceLastTap < 300) {
        onDoubleTap();
        lastTap.current = 0;
      } else {
        if (onTap) {
          onTap();
        }
        lastTap.current = now;
      }
    } 
    // Determine swipe direction
    else if (absX > threshold || absY > threshold) {
      if (absX > absY) {
        // Horizontal swipe
        if (deltaX > threshold && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < -threshold && onSwipeLeft) {
          onSwipeLeft();
        }
      } else {
        // Vertical swipe
        if (deltaY > threshold && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < -threshold && onSwipeUp) {
          onSwipeUp();
        }
      }
    }

    touchStart.current = null;
  }, [enabled, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap, onDoubleTap]);

  const handleTouchCancel = useCallback(() => {
    touchStart.current = null;
    initialPinchDistance.current = 0;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    // Add passive: false to prevent scroll while handling gestures
    const options = { passive: false };

    element.addEventListener('touchstart', handleTouchStart, options);
    element.addEventListener('touchmove', handleTouchMove, options);
    element.addEventListener('touchend', handleTouchEnd, options);
    element.addEventListener('touchcancel', handleTouchCancel, options);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
      
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  return ref;
}

// Hook for swipeable list items
export function useSwipeableListItem<T extends HTMLElement>(options: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onTap?: () => void;
  enabled?: boolean;
}) {
  const ref = useRef<T>(null);
  const { onSwipeLeft, onSwipeRight, onTap, enabled = true } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    const handleStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      startX = touch.clientX;
      isDragging = true;
      element.style.transition = 'none';
    };

    const handleMove = (e: TouchEvent) => {
      if (!isDragging) return;

      const touch = e.touches[0];
      if (!touch) return;

      currentX = touch.clientX;
      const deltaX = currentX - startX;
      
      // Apply resistance at edges
      const resistance = Math.abs(deltaX) > 100 ? 0.3 : 1;
      const transform = deltaX * resistance;
      
      element.style.transform = `translateX(${transform}px)`;
      
      // Show action indicators
      if (deltaX > 50) {
        element.classList.add('swipe-right');
        element.classList.remove('swipe-left');
      } else if (deltaX < -50) {
        element.classList.add('swipe-left');
        element.classList.remove('swipe-right');
      } else {
        element.classList.remove('swipe-left', 'swipe-right');
      }
    };

    const handleEnd = () => {
      if (!isDragging) return;
      
      isDragging = false;
      const deltaX = currentX - startX;
      
      element.style.transition = 'transform 0.3s ease-out';
      element.style.transform = '';
      element.classList.remove('swipe-left', 'swipe-right');
      
      if (Math.abs(deltaX) < 10 && onTap) {
        onTap();
      } else if (deltaX > 50 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < -50 && onSwipeLeft) {
        onSwipeLeft();
      }
    };

    element.addEventListener('touchstart', handleStart, { passive: true });
    element.addEventListener('touchmove', handleMove, { passive: false });
    element.addEventListener('touchend', handleEnd, { passive: true });
    element.addEventListener('touchcancel', handleEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleStart);
      element.removeEventListener('touchmove', handleMove);
      element.removeEventListener('touchend', handleEnd);
      element.removeEventListener('touchcancel', handleEnd);
    };
  }, [enabled, onSwipeLeft, onSwipeRight, onTap]);

  return ref;
}
