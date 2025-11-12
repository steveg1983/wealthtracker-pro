import React, { useCallback } from 'react';

/**
 * Haptic feedback patterns
 */
export const HapticPattern = {
  /** Light tap - for button presses, UI feedback */
  LIGHT: 'light',
  /** Medium tap - for selection, toggle actions */
  MEDIUM: 'medium',
  /** Heavy tap - for important actions, confirmations */
  HEAVY: 'heavy',
  /** Success - for successful operations */
  SUCCESS: 'success',
  /** Warning - for warning states */
  WARNING: 'warning',
  /** Error - for error states */
  ERROR: 'error',
  /** Selection - for item selection */
  SELECTION: 'selection',
  /** Impact - for collisions, drops */
  IMPACT: 'impact',
  /** Notification - for notifications, alerts */
  NOTIFICATION: 'notification'
} as const;

export type HapticPatternType = typeof HapticPattern[keyof typeof HapticPattern];

interface HapticOptions {
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
    // iOS Haptic Feedback API
    if ('navigator' in window && 'vibrate' in navigator) return true;
    
    // iOS specific haptic feedback (iOS 10+)
    // Check for requestPermission on DeviceMotionEvent (iOS 13+)
    if (window.DeviceMotionEvent && 'requestPermission' in DeviceMotionEvent) {
      return true;
    }
    
    // Gamepad API haptic feedback
    if ('navigator' in window && 'getGamepads' in navigator) {
      const gamepads = navigator.getGamepads();
      return Array.from(gamepads).some(gamepad => 
        gamepad && gamepad.vibrationActuator
      );
    }
    
    return false;
  }, []);

  // Check user preferences
  const isHapticEnabled = useCallback((): boolean => {
    // Check user preference
    const userPreference = localStorage.getItem('haptic-feedback-enabled');
    if (userPreference !== null) {
      return userPreference === 'true';
    }
    
    // Check system preference for reduced motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
    
    // Default to enabled on mobile devices
    return window.innerWidth <= 768;
  }, []);

  // Trigger haptic feedback
  const triggerHaptic = useCallback(async (
    pattern: HapticPatternType = HapticPattern.LIGHT,
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
      // iOS Haptic Feedback (modern iOS devices)
      if ('navigator' in window && 'vibrate' in navigator) {
        const vibrationPattern = getVibrationPattern(pattern, intensity);
        navigator.vibrate(vibrationPattern);
        return true;
      }
      
      // iOS Haptic Feedback API (if available)
      // Note: This requires HTTPS and user gesture
      if (window.navigator && (window.navigator as any).hapticFeedback) {
        const hapticAPI = (window.navigator as any).hapticFeedback;
        const hapticType = getIOSHapticType(pattern);
        
        if (hapticAPI[hapticType]) {
          hapticAPI[hapticType]();
          return true;
        }
      }
      
      // Gamepad haptic feedback
      if ('navigator' in window && 'getGamepads' in navigator) {
        const gamepads = navigator.getGamepads();
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
      if ('navigator' in window && 'vibrate' in navigator) {
        const vibrationPattern = getVibrationPattern(pattern, intensity);
        navigator.vibrate(vibrationPattern);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
      return false;
    }
  }, [isHapticAvailable, isHapticEnabled]);

  // Convenience methods for common patterns
  const light = useCallback((options?: HapticOptions) => 
    triggerHaptic(HapticPattern.LIGHT, options), [triggerHaptic]);
  
  const medium = useCallback((options?: HapticOptions) => 
    triggerHaptic(HapticPattern.MEDIUM, options), [triggerHaptic]);
  
  const heavy = useCallback((options?: HapticOptions) => 
    triggerHaptic(HapticPattern.HEAVY, options), [triggerHaptic]);
  
  const success = useCallback((options?: HapticOptions) => 
    triggerHaptic(HapticPattern.SUCCESS, options), [triggerHaptic]);
  
  const warning = useCallback((options?: HapticOptions) => 
    triggerHaptic(HapticPattern.WARNING, options), [triggerHaptic]);
  
  const error = useCallback((options?: HapticOptions) => 
    triggerHaptic(HapticPattern.ERROR, options), [triggerHaptic]);
  
  const selection = useCallback((options?: HapticOptions) => 
    triggerHaptic(HapticPattern.SELECTION, options), [triggerHaptic]);
  
  const impact = useCallback((options?: HapticOptions) => 
    triggerHaptic(HapticPattern.IMPACT, options), [triggerHaptic]);
  
  const notification = useCallback((options?: HapticOptions) => 
    triggerHaptic(HapticPattern.NOTIFICATION, options), [triggerHaptic]);

  // Enable/disable haptic feedback
  const setHapticEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem('haptic-feedback-enabled', enabled.toString());
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
function getVibrationPattern(pattern: HapticPatternType, intensity: number = 1.0): number | number[] {
  const baseIntensity = Math.max(0, Math.min(1, intensity));
  
  switch (pattern) {
    case HapticPattern.LIGHT:
      return Math.round(10 * baseIntensity);
    
    case HapticPattern.MEDIUM:
      return Math.round(30 * baseIntensity);
    
    case HapticPattern.HEAVY:
      return Math.round(50 * baseIntensity);
    
    case HapticPattern.SUCCESS:
      return [
        Math.round(15 * baseIntensity), 
        10, 
        Math.round(15 * baseIntensity)
      ];
    
    case HapticPattern.WARNING:
      return [
        Math.round(25 * baseIntensity), 
        15, 
        Math.round(25 * baseIntensity), 
        15, 
        Math.round(25 * baseIntensity)
      ];
    
    case HapticPattern.ERROR:
      return [
        Math.round(40 * baseIntensity), 
        20, 
        Math.round(40 * baseIntensity), 
        20, 
        Math.round(40 * baseIntensity)
      ];
    
    case HapticPattern.SELECTION:
      return Math.round(8 * baseIntensity);
    
    case HapticPattern.IMPACT:
      return Math.round(35 * baseIntensity);
    
    case HapticPattern.NOTIFICATION:
      return [
        Math.round(20 * baseIntensity), 
        10, 
        Math.round(10 * baseIntensity), 
        10, 
        Math.round(20 * baseIntensity)
      ];
    
    default:
      return Math.round(15 * baseIntensity);
  }
}

/**
 * Get iOS haptic type
 */
function getIOSHapticType(pattern: HapticPatternType): string {
  switch (pattern) {
    case HapticPattern.LIGHT:
    case HapticPattern.SELECTION:
      return 'impactLight';
    
    case HapticPattern.MEDIUM:
      return 'impactMedium';
    
    case HapticPattern.HEAVY:
    case HapticPattern.IMPACT:
      return 'impactHeavy';
    
    case HapticPattern.SUCCESS:
      return 'notificationSuccess';
    
    case HapticPattern.WARNING:
      return 'notificationWarning';
    
    case HapticPattern.ERROR:
      return 'notificationError';
    
    case HapticPattern.NOTIFICATION:
      return 'selectionChanged';
    
    default:
      return 'impactLight';
  }
}

/**
 * Get gamepad vibration parameters
 */
function getGamepadVibration(pattern: HapticPatternType, intensity: number = 1.0) {
  const baseIntensity = Math.max(0, Math.min(1, intensity));
  
  switch (pattern) {
    case HapticPattern.LIGHT:
      return {
        duration: 50,
        startDelay: 0,
        strongMagnitude: 0,
        weakMagnitude: 0.3 * baseIntensity
      };
    
    case HapticPattern.MEDIUM:
      return {
        duration: 100,
        startDelay: 0,
        strongMagnitude: 0.3 * baseIntensity,
        weakMagnitude: 0.5 * baseIntensity
      };
    
    case HapticPattern.HEAVY:
      return {
        duration: 150,
        startDelay: 0,
        strongMagnitude: 0.8 * baseIntensity,
        weakMagnitude: 0.4 * baseIntensity
      };
    
    case HapticPattern.SUCCESS:
      return {
        duration: 200,
        startDelay: 0,
        strongMagnitude: 0.5 * baseIntensity,
        weakMagnitude: 0.7 * baseIntensity
      };
    
    case HapticPattern.ERROR:
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
export function HapticWrapper({
  children,
  pattern = HapticPattern.LIGHT,
  trigger = 'click',
  options = {},
  disabled = false
}: {
  children: React.ReactElement;
  pattern?: HapticPatternType;
  trigger?: 'click' | 'focus' | 'hover' | 'touchstart';
  options?: HapticOptions;
  disabled?: boolean;
}) {
  const { trigger: triggerHaptic } = useHapticFeedback();
  
  if (disabled) return children;
  
  const handleTrigger = () => {
    triggerHaptic(pattern, options);
  };
  
  const props: Record<string, any> = {};
  
  switch (trigger) {
    case 'click':
      props.onClick = (e: Event) => {
        handleTrigger();
        children.props.onClick?.(e);
      };
      break;
    case 'focus':
      props.onFocus = (e: Event) => {
        handleTrigger();
        children.props.onFocus?.(e);
      };
      break;
    case 'hover':
      props.onMouseEnter = (e: Event) => {
        handleTrigger();
        children.props.onMouseEnter?.(e);
      };
      break;
    case 'touchstart':
      props.onTouchStart = (e: Event) => {
        handleTrigger();
        children.props.onTouchStart?.(e);
      };
      break;
  }
  
  return React.cloneElement(children, props);
}

/**
 * Higher-order component for adding haptic feedback
 */
export function withHapticFeedback<P extends object>(
  Component: React.ComponentType<P>,
  defaultPattern: HapticPatternType = HapticPattern.LIGHT
) {
  return function HapticEnhancedComponent(props: P & {
    hapticPattern?: HapticPatternType;
    hapticOptions?: HapticOptions;
    hapticDisabled?: boolean;
  }) {
    const { 
      hapticPattern = defaultPattern,
      hapticOptions = {},
      hapticDisabled = false,
      ...componentProps 
    } = props;
    
    const { trigger } = useHapticFeedback();
    
    const enhancedProps = {
      ...componentProps,
      onClick: (e: any) => {
        if (!hapticDisabled) {
          trigger(hapticPattern, hapticOptions);
        }
        (componentProps as any).onClick?.(e);
      }
    } as P;
    
    return <Component {...enhancedProps} />;
  };
}

export default useHapticFeedback;