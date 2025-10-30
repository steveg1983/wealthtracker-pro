import { useCallback } from 'react';
import { logger } from '../services/loggingService';
import { Decimal, toDecimal } from '@wealthtracker/utils';

type ExtendedNavigator = Navigator & {
  vibrate?: (pattern: number | number[]) => boolean;
  getGamepads?: () => (Gamepad | null)[];
  hapticFeedback?: Record<string, () => void>;
};

const getNavigator = (): ExtendedNavigator | undefined => {
  return typeof navigator !== 'undefined' ? (navigator as ExtendedNavigator) : undefined;
};

/**
 * Haptic feedback patterns
 */
export const HAPTIC_PATTERN = {
  LIGHT: 'light',
  MEDIUM: 'medium',
  HEAVY: 'heavy',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  SELECTION: 'selection',
  IMPACT: 'impact',
  NOTIFICATION: 'notification',
} as const;

export type HapticPattern = typeof HAPTIC_PATTERN[keyof typeof HAPTIC_PATTERN];

export interface HapticOptions {
  /** Force the haptic even if user has disabled it */
  force?: boolean;
  /** Delay before triggering haptic (ms) */
  delay?: number;
  /** Custom intensity (0-1) for supported devices */
  intensity?: number;
}

/**
 * Hook for haptic feedback across devices
 * Supports iOS Haptic Feedback API and Android Vibration API
 */
export function useHapticFeedback() {
  // Check if haptic feedback is available
  const isHapticAvailable = useCallback((): boolean => {
    const nav = getNavigator();

    // iOS Haptic Feedback API
    if (nav?.vibrate) return true;
    
    // iOS specific haptic feedback (iOS 10+)
    const deviceMotion = (window as typeof window & {
      DeviceMotionEvent?: {
        requestPermission?: () => Promise<PermissionState>;
      };
    }).DeviceMotionEvent;
    if (deviceMotion && typeof deviceMotion.requestPermission === 'function') {
      return true;
    }
    
    // Gamepad API haptic feedback
    const getGamepads = nav?.getGamepads;
    if (typeof getGamepads === 'function') {
      const gamepads = getGamepads.call(nav);
      return Array.from(gamepads).some(gamepad => 
        gamepad && gamepad.vibrationActuator
      );
    }
    
    return false;
  }, []);

  // Check user preferences
  const isHapticEnabled = useCallback((): boolean => {
    // Check user preference
    const userPreference = typeof localStorage !== 'undefined'
      ? localStorage.getItem('haptic-feedback-enabled')
      : null;
    if (userPreference !== null) {
      return userPreference === 'true';
    }
    
    // Check system preference for reduced motion
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
    
    // Default to enabled on mobile devices
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }, []);

  // Trigger haptic feedback
  const triggerHaptic = useCallback(async (
    pattern: HapticPattern = HAPTIC_PATTERN.LIGHT,
    options: HapticOptions = {}
  ): Promise<boolean> => {
    const { force = false, delay = 0, intensity = 1.0 } = options;
    
    // Check if haptic is available and enabled
    if (!force && (!isHapticAvailable() || !isHapticEnabled())) {
      return false;
    }
    
    // Apply delay if specified
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    try {
      const nav = getNavigator();

      // iOS Haptic Feedback (modern iOS devices)
      if (nav?.vibrate) {
        const vibrationPattern = getVibrationPattern(pattern, intensity);
        nav.vibrate(vibrationPattern);
        return true;
      }
      
      // iOS Haptic Feedback API (if available)
      // Note: This requires HTTPS and user gesture
      const hapticAPI = nav?.hapticFeedback;
      if (hapticAPI) {
        const hapticType = getIOSHapticType(pattern);
        
        if (hapticAPI[hapticType]) {
          hapticAPI[hapticType]();
          return true;
        }
      }
      
      // Gamepad haptic feedback
      const getGamepads = nav?.getGamepads;
      if (typeof getGamepads === 'function') {
        const gamepads = getGamepads.call(nav);
        for (const gamepad of gamepads) {
          if (gamepad && gamepad.vibrationActuator) {
            const { duration, startDelay, strongMagnitude, weakMagnitude } = 
              getGamepadVibration(pattern, intensity);
            
            gamepad.vibrationActuator.playEffect('dual-rumble', {
              duration,
              startDelay,
              strongMagnitude,
              weakMagnitude
            });
            return true;
          }
        }
      }
      
      // Fallback: Web Vibration API
      if (nav?.vibrate) {
        const vibrationPattern = getVibrationPattern(pattern, intensity);
        nav.vibrate(vibrationPattern);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.warn('Haptic feedback failed', error, 'useHapticFeedback');
      return false;
    }
  }, [isHapticAvailable, isHapticEnabled]);

  // Convenience methods for common patterns
  const light = useCallback((options?: HapticOptions) => 
    triggerHaptic(HAPTIC_PATTERN.LIGHT, options), [triggerHaptic]);
  
  const medium = useCallback((options?: HapticOptions) => 
    triggerHaptic(HAPTIC_PATTERN.MEDIUM, options), [triggerHaptic]);
  
  const heavy = useCallback((options?: HapticOptions) => 
    triggerHaptic(HAPTIC_PATTERN.HEAVY, options), [triggerHaptic]);
  
  const success = useCallback((options?: HapticOptions) => 
    triggerHaptic(HAPTIC_PATTERN.SUCCESS, options), [triggerHaptic]);
  
  const warning = useCallback((options?: HapticOptions) => 
    triggerHaptic(HAPTIC_PATTERN.WARNING, options), [triggerHaptic]);
  
  const error = useCallback((options?: HapticOptions) => 
    triggerHaptic(HAPTIC_PATTERN.ERROR, options), [triggerHaptic]);
  
  const selection = useCallback((options?: HapticOptions) => 
    triggerHaptic(HAPTIC_PATTERN.SELECTION, options), [triggerHaptic]);
  
  const impact = useCallback((options?: HapticOptions) => 
    triggerHaptic(HAPTIC_PATTERN.IMPACT, options), [triggerHaptic]);
  
  const notification = useCallback((options?: HapticOptions) => 
    triggerHaptic(HAPTIC_PATTERN.NOTIFICATION, options), [triggerHaptic]);

  // Enable/disable haptic feedback
  const setHapticEnabled = useCallback((enabled: boolean) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('haptic-feedback-enabled', enabled.toString());
    }
  }, []);

  return {
    // State
    isAvailable: isHapticAvailable(),
    isEnabled: isHapticEnabled(),
    
    // Main trigger function
    trigger: triggerHaptic,
    
    // Convenience methods
    light,
    medium,
    heavy,
    success,
    warning,
    error,
    selection,
    impact,
    notification,
    
    // Settings
    setEnabled: setHapticEnabled
  };
}

/**
 * Get vibration pattern for Web Vibration API
 */
function getVibrationPattern(pattern: HapticPattern, intensity: number = 1.0): number | number[] {
  const baseIntensity = Decimal.max(0, Decimal.min(1, toDecimal(intensity)));
  
  switch (pattern) {
    case HAPTIC_PATTERN.LIGHT:
      return baseIntensity.times(10).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    
    case HAPTIC_PATTERN.MEDIUM:
      return baseIntensity.times(30).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    
    case HAPTIC_PATTERN.HEAVY:
      return baseIntensity.times(50).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    
    case HAPTIC_PATTERN.SUCCESS:
      return [
        baseIntensity.times(15).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
        10,
        baseIntensity.times(15).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
      ];
    
    case HAPTIC_PATTERN.WARNING:
      return [
        baseIntensity.times(25).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
        15,
        baseIntensity.times(25).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
        15,
        baseIntensity.times(25).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
      ];
    
    case HAPTIC_PATTERN.ERROR:
      return [
        baseIntensity.times(40).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
        20,
        baseIntensity.times(40).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
        20,
        baseIntensity.times(40).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
      ];
    
    case HAPTIC_PATTERN.SELECTION:
      return baseIntensity.times(8).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    
    case HAPTIC_PATTERN.IMPACT:
      return baseIntensity.times(35).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    
    case HAPTIC_PATTERN.NOTIFICATION:
      return [
        baseIntensity.times(20).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
        10,
        baseIntensity.times(10).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
        10,
        baseIntensity.times(20).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
      ];
    
    default:
      return baseIntensity.times(15).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  }
}

/**
 * Get iOS haptic type
 */
function getIOSHapticType(pattern: HapticPattern): string {
  switch (pattern) {
    case HAPTIC_PATTERN.LIGHT:
    case HAPTIC_PATTERN.SELECTION:
      return 'impactLight';
    
    case HAPTIC_PATTERN.MEDIUM:
      return 'impactMedium';
    
    case HAPTIC_PATTERN.HEAVY:
    case HAPTIC_PATTERN.IMPACT:
      return 'impactHeavy';
    
    case HAPTIC_PATTERN.SUCCESS:
      return 'notificationSuccess';
    
    case HAPTIC_PATTERN.WARNING:
      return 'notificationWarning';
    
    case HAPTIC_PATTERN.ERROR:
      return 'notificationError';
    
    case HAPTIC_PATTERN.NOTIFICATION:
      return 'selectionChanged';
    
    default:
      return 'impactLight';
  }
}

/**
 * Get gamepad vibration parameters
 */
function getGamepadVibration(pattern: HapticPattern, intensity: number = 1.0) {
  const baseIntensity = Math.max(0, Math.min(1, intensity));
  
  switch (pattern) {
    case HAPTIC_PATTERN.LIGHT:
      return {
        duration: 50,
        startDelay: 0,
        strongMagnitude: 0,
        weakMagnitude: 0.3 * baseIntensity
      };
    
    case HAPTIC_PATTERN.MEDIUM:
      return {
        duration: 100,
        startDelay: 0,
        strongMagnitude: 0.3 * baseIntensity,
        weakMagnitude: 0.5 * baseIntensity
      };
    
    case HAPTIC_PATTERN.HEAVY:
      return {
        duration: 150,
        startDelay: 0,
        strongMagnitude: 0.8 * baseIntensity,
        weakMagnitude: 0.4 * baseIntensity
      };
    
    case HAPTIC_PATTERN.SUCCESS:
      return {
        duration: 200,
        startDelay: 0,
        strongMagnitude: 0.5 * baseIntensity,
        weakMagnitude: 0.7 * baseIntensity
      };
    
    case HAPTIC_PATTERN.ERROR:
      return {
        duration: 300,
        startDelay: 0,
        strongMagnitude: 1.0 * baseIntensity,
        weakMagnitude: 0.8 * baseIntensity
      };
    
    default:
      return {
        duration: 75,
        startDelay: 0,
        strongMagnitude: 0.2 * baseIntensity,
        weakMagnitude: 0.4 * baseIntensity
      };
  }
}

/**
 * Component wrapper that adds haptic feedback to children
 */
export default useHapticFeedback;
