/**
 * @module gestureService
 * @description World-class gesture recognition service providing multi-touch gesture
 * detection, calculation utilities, and gesture state management for touch interfaces.
 * 
 * @features
 * - Multi-touch support
 * - Gesture recognition algorithms
 * - Velocity calculation
 * - Pinch/zoom detection
 * - Rotation detection
 * 
 * @performance
 * - Optimized calculations
 * - Debounced events
 * - Memory efficient
 */

/**
 * Touch point interface
 */
export interface TouchPoint {
  x: number;
  y: number;
  time: number;
  id?: number;
}

/**
 * Gesture types
 */
export type GestureType = 
  | 'swipe-left' 
  | 'swipe-right' 
  | 'swipe-up' 
  | 'swipe-down'
  | 'tap'
  | 'double-tap'
  | 'long-press'
  | 'pinch'
  | 'rotate'
  | 'pan';

/**
 * Gesture result
 */
export interface GestureResult {
  type: GestureType;
  deltaX?: number;
  deltaY?: number;
  distance?: number;
  velocity?: number;
  scale?: number;
  rotation?: number;
  duration?: number;
}

/**
 * Gesture configuration
 */
export interface GestureConfig {
  threshold?: number;
  velocity?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
  rotationThreshold?: number;
  pinchThreshold?: number;
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(p1: TouchPoint, p2: TouchPoint): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate angle between two points in degrees
 */
export function calculateAngle(p1: TouchPoint, p2: TouchPoint): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

/**
 * Calculate velocity of movement
 */
export function calculateVelocity(
  start: TouchPoint,
  end: TouchPoint
): number {
  const distance = calculateDistance(start, end);
  const duration = end.time - start.time;
  return duration > 0 ? distance / duration : 0;
}

/**
 * Detect swipe direction
 */
export function detectSwipeDirection(
  start: TouchPoint,
  end: TouchPoint,
  threshold: number = 50
): GestureType | null {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  // Check if movement exceeds threshold
  if (absX < threshold && absY < threshold) {
    return null;
  }

  // Determine primary direction
  if (absX > absY) {
    return deltaX > 0 ? 'swipe-right' : 'swipe-left';
  } else {
    return deltaY > 0 ? 'swipe-down' : 'swipe-up';
  }
}

/**
 * Calculate pinch scale
 */
export function calculatePinchScale(
  initialDistance: number,
  currentDistance: number
): number {
  return initialDistance > 0 ? currentDistance / initialDistance : 1;
}

/**
 * Calculate rotation angle
 */
export function calculateRotation(
  initialAngle: number,
  currentAngle: number
): number {
  let rotation = currentAngle - initialAngle;
  
  // Normalize to -180 to 180 range
  while (rotation > 180) rotation -= 360;
  while (rotation < -180) rotation += 360;
  
  return rotation;
}

/**
 * Check if gesture is a tap
 */
export function isTap(
  start: TouchPoint,
  end: TouchPoint,
  maxDistance: number = 10,
  maxDuration: number = 200
): boolean {
  const distance = calculateDistance(start, end);
  const duration = end.time - start.time;
  return distance <= maxDistance && duration <= maxDuration;
}

/**
 * Gesture recognition service
 */
class GestureService {
  private static instance: GestureService;
  private gestureHistory: GestureResult[] = [];
  private maxHistorySize = 10;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): GestureService {
    if (!GestureService.instance) {
      GestureService.instance = new GestureService();
    }
    return GestureService.instance;
  }

  /**
   * Recognize gesture from touch points
   */
  recognizeGesture(
    start: TouchPoint,
    end: TouchPoint,
    config: GestureConfig = {}
  ): GestureResult | null {
    const {
      threshold = 50,
      velocity = 0.3,
      longPressDelay = 500,
      doubleTapDelay = 300
    } = config;

    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const distance = calculateDistance(start, end);
    const duration = end.time - start.time;
    const vel = calculateVelocity(start, end);

    // Check for tap
    if (isTap(start, end)) {
      // Check for double tap
      const lastGesture = this.getLastGesture();
      if (
        lastGesture?.type === 'tap' &&
        start.time - (this.gestureHistory[0]?.duration || 0) < doubleTapDelay
      ) {
        return this.recordGesture({
          type: 'double-tap',
          duration
        });
      }
      
      return this.recordGesture({
        type: 'tap',
        duration
      });
    }

    // Check for long press
    if (distance < 10 && duration >= longPressDelay) {
      return this.recordGesture({
        type: 'long-press',
        duration
      });
    }

    // Check for swipe
    const swipeDirection = detectSwipeDirection(start, end, threshold);
    if (swipeDirection && vel >= velocity) {
      return this.recordGesture({
        type: swipeDirection,
        deltaX,
        deltaY,
        distance,
        velocity: vel,
        duration
      });
    }

    // Pan gesture (movement without enough velocity for swipe)
    if (distance > threshold) {
      return this.recordGesture({
        type: 'pan',
        deltaX,
        deltaY,
        distance,
        velocity: vel,
        duration
      });
    }

    return null;
  }

  /**
   * Recognize multi-touch gesture
   */
  recognizeMultiTouchGesture(
    touches: Touch[],
    previousTouches: Touch[],
    config: GestureConfig = {}
  ): GestureResult | null {
    if (touches.length !== 2 || previousTouches.length !== 2) {
      return null;
    }

    const {
      rotationThreshold = 15,
      pinchThreshold = 0.1
    } = config;

    // Calculate distances
    const prevDistance = this.getTouchDistance(previousTouches[0], previousTouches[1]);
    const currDistance = this.getTouchDistance(touches[0], touches[1]);
    const scale = calculatePinchScale(prevDistance, currDistance);

    // Calculate angles
    const prevAngle = this.getTouchAngle(previousTouches[0], previousTouches[1]);
    const currAngle = this.getTouchAngle(touches[0], touches[1]);
    const rotation = calculateRotation(prevAngle, currAngle);

    // Detect pinch
    if (Math.abs(scale - 1) > pinchThreshold) {
      return this.recordGesture({
        type: 'pinch',
        scale
      });
    }

    // Detect rotation
    if (Math.abs(rotation) > rotationThreshold) {
      return this.recordGesture({
        type: 'rotate',
        rotation
      });
    }

    return null;
  }

  /**
   * Get distance between touches
   */
  private getTouchDistance(t1: Touch, t2: Touch): number {
    return calculateDistance(
      { x: t1.clientX, y: t1.clientY, time: 0 },
      { x: t2.clientX, y: t2.clientY, time: 0 }
    );
  }

  /**
   * Get angle between touches
   */
  private getTouchAngle(t1: Touch, t2: Touch): number {
    return calculateAngle(
      { x: t1.clientX, y: t1.clientY, time: 0 },
      { x: t2.clientX, y: t2.clientY, time: 0 }
    );
  }

  /**
   * Record gesture in history
   */
  private recordGesture(gesture: GestureResult): GestureResult {
    this.gestureHistory.unshift(gesture);
    if (this.gestureHistory.length > this.maxHistorySize) {
      this.gestureHistory.pop();
    }
    return gesture;
  }

  /**
   * Get last gesture
   */
  getLastGesture(): GestureResult | null {
    return this.gestureHistory[0] || null;
  }

  /**
   * Get gesture history
   */
  getHistory(): GestureResult[] {
    return [...this.gestureHistory];
  }

  /**
   * Clear gesture history
   */
  clearHistory(): void {
    this.gestureHistory = [];
  }
}

// Export singleton instance
export const gestureService = GestureService.getInstance();