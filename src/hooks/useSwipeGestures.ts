import { useRef, useEffect, useCallback, useState } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  onPinch?: (scale: number) => void;
  onRotate?: (angle: number) => void;
}

interface SwipeConfig {
  threshold?: number;
  velocity?: number;
  preventDefaultTouchmove?: boolean;
  trackMouse?: boolean;
  rotationAngle?: number;
  delta?: number;
  preventScrollOnSwipe?: boolean;
  longPressDelay?: number;
  doubleTapDelay?: number;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

/**
 * Advanced swipe gesture detection hook
 * Supports swipe, tap, double tap, long press, pinch, and rotate
 */
export function useSwipeGestures<T extends HTMLElement = HTMLElement>(
  handlers: SwipeHandlers,
  config: SwipeConfig = {}
) {
  const {
    threshold = 50,
    velocity = 0.3,
    preventDefaultTouchmove = false,
    trackMouse = false,
    rotationAngle: _rotationAngle = 0,
    delta = 10,
    preventScrollOnSwipe = true,
    longPressDelay = 500,
    doubleTapDelay = 300
  } = config;

  const [isSwipe, setIsSwipe] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<string | null>(null);
  const [swipeDistance, setSwipeDistance] = useState(0);
  
  const touchStart = useRef<TouchPoint | null>(null);
  const touchEnd = useRef<TouchPoint | null>(null);
  const lastTap = useRef<number>(0);
  const longPressTimer = useRef<NodeJS.Timeout>();
  const initialDistance = useRef<number>(0);
  const initialAngle = useRef<number>(0);
  const elementRef = useRef<T>(null);

  // Calculate distance between two points
  const getDistance = useCallback((p1: Touch, p2: Touch): number => {
    const dx = p1.clientX - p2.clientX;
    const dy = p1.clientY - p2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Calculate angle between two points
  const getAngle = useCallback((p1: Touch, p2: Touch): number => {
    const dx = p1.clientX - p2.clientX;
    const dy = p1.clientY - p2.clientY;
    return Math.atan2(dy, dx) * 180 / Math.PI;
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1) {
      // Single touch
      const touch = e.touches[0];
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
      
      // Start long press timer
      longPressTimer.current = setTimeout(() => {
        if (handlers.onLongPress && touchStart.current) {
          handlers.onLongPress();
          touchStart.current = null; // Prevent swipe after long press
        }
      }, longPressDelay);
      
    } else if (e.touches.length === 2) {
      // Multi-touch for pinch/rotate
      initialDistance.current = getDistance(e.touches[0], e.touches[1]);
      initialAngle.current = getAngle(e.touches[0], e.touches[1]);
    }
    
    setIsSwipe(false);
    setSwipeDirection(null);
  }, [handlers, longPressDelay, getDistance, getAngle]);

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (preventDefaultTouchmove) {
      e.preventDefault();
    }

    // Clear long press timer on move
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }

    if (e.touches.length === 1 && touchStart.current) {
      // Single touch swipe
      const touch = e.touches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      setSwipeDistance(distance);
      
      if (distance > delta) {
        setIsSwipe(true);
        
        // Determine direction
        if (Math.abs(dx) > Math.abs(dy)) {
          setSwipeDirection(dx > 0 ? 'right' : 'left');
        } else {
          setSwipeDirection(dy > 0 ? 'down' : 'up');
        }
        
        if (preventScrollOnSwipe) {
          e.preventDefault();
        }
      }
      
    } else if (e.touches.length === 2) {
      // Pinch/Rotate gestures
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const currentAngle = getAngle(e.touches[0], e.touches[1]);
      
      // Pinch gesture
      if (handlers.onPinch && initialDistance.current) {
        const scale = currentDistance / initialDistance.current;
        handlers.onPinch(scale);
      }
      
      // Rotate gesture
      if (handlers.onRotate && initialAngle.current) {
        const rotation = currentAngle - initialAngle.current;
        handlers.onRotate(rotation);
      }
      
      e.preventDefault();
    }
  }, [
    preventDefaultTouchmove,
    preventScrollOnSwipe,
    delta,
    handlers,
    getDistance,
    getAngle
  ]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }

    if (!touchStart.current) return;

    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStart.current.time;
    
    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      touchEnd.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: touchEndTime
      };

      const dx = touchEnd.current.x - touchStart.current.x;
      const dy = touchEnd.current.y - touchStart.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const velocityX = Math.abs(dx / touchDuration);
      const velocityY = Math.abs(dy / touchDuration);

      // Check for tap/double tap
      if (distance < delta && touchDuration < 200) {
        // Check for double tap
        if (touchEndTime - lastTap.current < doubleTapDelay) {
          if (handlers.onDoubleTap) {
            handlers.onDoubleTap();
          }
          lastTap.current = 0;
        } else {
          // Single tap
          if (handlers.onTap) {
            handlers.onTap();
          }
          lastTap.current = touchEndTime;
        }
      }
      // Check for swipe
      else if (distance > threshold || velocityX > velocity || velocityY > velocity) {
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal swipe
          if (dx > 0 && handlers.onSwipeRight) {
            handlers.onSwipeRight();
          } else if (dx < 0 && handlers.onSwipeLeft) {
            handlers.onSwipeLeft();
          }
        } else {
          // Vertical swipe
          if (dy > 0 && handlers.onSwipeDown) {
            handlers.onSwipeDown();
          } else if (dy < 0 && handlers.onSwipeUp) {
            handlers.onSwipeUp();
          }
        }
      }
    }

    // Reset
    touchStart.current = null;
    touchEnd.current = null;
    initialDistance.current = 0;
    initialAngle.current = 0;
    setIsSwipe(false);
    setSwipeDirection(null);
    setSwipeDistance(0);
  }, [
    threshold,
    velocity,
    delta,
    doubleTapDelay,
    handlers
  ]);

  // Mouse event handlers (optional)
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!trackMouse) return;
    
    touchStart.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now()
    };
    
    longPressTimer.current = setTimeout(() => {
      if (handlers.onLongPress && touchStart.current) {
        handlers.onLongPress();
        touchStart.current = null;
      }
    }, longPressDelay);
  }, [trackMouse, handlers, longPressDelay]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!trackMouse || !touchStart.current) return;
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    const dx = e.clientX - touchStart.current.x;
    const dy = e.clientY - touchStart.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > delta) {
      setIsSwipe(true);
      setSwipeDistance(distance);
      
      if (Math.abs(dx) > Math.abs(dy)) {
        setSwipeDirection(dx > 0 ? 'right' : 'left');
      } else {
        setSwipeDirection(dy > 0 ? 'down' : 'up');
      }
    }
  }, [trackMouse, delta]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!trackMouse || !touchStart.current) return;
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    const dx = e.clientX - touchStart.current.x;
    const dy = e.clientY - touchStart.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const duration = Date.now() - touchStart.current.time;
    
    if (distance < delta && duration < 200) {
      if (handlers.onTap) {
        handlers.onTap();
      }
    } else if (distance > threshold) {
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && handlers.onSwipeRight) {
          handlers.onSwipeRight();
        } else if (dx < 0 && handlers.onSwipeLeft) {
          handlers.onSwipeLeft();
        }
      } else {
        if (dy > 0 && handlers.onSwipeDown) {
          handlers.onSwipeDown();
        } else if (dy < 0 && handlers.onSwipeUp) {
          handlers.onSwipeUp();
        }
      }
    }
    
    touchStart.current = null;
    setIsSwipe(false);
    setSwipeDirection(null);
    setSwipeDistance(0);
  }, [trackMouse, threshold, delta, handlers]);

  // Setup event listeners
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Touch events
    element.addEventListener('touchstart', handleTouchStart, { passive: !preventDefaultTouchmove });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefaultTouchmove });
    element.addEventListener('touchend', handleTouchEnd);
    
    // Mouse events (optional)
    if (trackMouse) {
      element.addEventListener('mousedown', handleMouseDown);
      element.addEventListener('mousemove', handleMouseMove);
      element.addEventListener('mouseup', handleMouseUp);
      element.addEventListener('mouseleave', handleMouseUp);
    }

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      
      if (trackMouse) {
        element.removeEventListener('mousedown', handleMouseDown);
        element.removeEventListener('mousemove', handleMouseMove);
        element.removeEventListener('mouseup', handleMouseUp);
        element.removeEventListener('mouseleave', handleMouseUp);
      }
      
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    preventDefaultTouchmove,
    trackMouse
  ]);

  return {
    ref: elementRef,
    isSwipe,
    swipeDirection,
    swipeDistance,
    bind: {
      ref: elementRef
    }
  };
}

/**
 * Hook for swipeable list items
 */
export function useSwipeableItem(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onTap?: () => void
) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const { ref, swipeDistance, swipeDirection } = useSwipeGestures({
    onSwipeLeft,
    onSwipeRight,
    onTap
  }, {
    threshold: 75,
    preventScrollOnSwipe: true
  });

  useEffect(() => {
    if (swipeDirection === 'left' || swipeDirection === 'right') {
      setIsDragging(true);
      setOffset(swipeDirection === 'left' ? -swipeDistance : swipeDistance);
    } else {
      setIsDragging(false);
      setOffset(0);
    }
  }, [swipeDistance, swipeDirection]);

  return {
    ref,
    offset,
    isDragging,
    style: {
      transform: `translateX(${offset}px)`,
      transition: isDragging ? 'none' : 'transform 0.3s ease'
    }
  };
}