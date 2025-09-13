/**
 * @module hapticPatterns
 * @description World-class haptic feedback pattern definitions and utilities
 * for cross-platform haptic feedback support.
 * 
 * @performance
 * - Optimized pattern definitions
 * - Minimal memory footprint
 * 
 * @accessibility
 * - Respects user preferences
 * - Fallback for unsupported devices
 */

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

/**
 * Haptic feedback options
 */
export interface HapticOptions {
  /** Force the haptic even if user has disabled it */
  force?: boolean;
  /** Delay before triggering haptic (ms) */
  delay?: number;
  /** Custom intensity (0-1) for supported devices */
  intensity?: number;
}

/**
 * Get vibration pattern for different haptic types
 */
export function getVibrationPattern(pattern: HapticPatternType, intensity: number = 1.0): number | number[] {
  const baseIntensity = Math.min(Math.max(intensity, 0), 1.0);
  
  switch (pattern) {
    case HapticPattern.LIGHT:
      return Math.round(10 * baseIntensity);
    
    case HapticPattern.MEDIUM:
      return Math.round(20 * baseIntensity);
    
    case HapticPattern.HEAVY:
      return Math.round(30 * baseIntensity);
    
    case HapticPattern.SUCCESS:
      // Two short pulses
      return [
        Math.round(15 * baseIntensity),
        Math.round(50 * baseIntensity),
        Math.round(15 * baseIntensity)
      ];
    
    case HapticPattern.WARNING:
      // Three medium pulses
      return [
        Math.round(20 * baseIntensity),
        Math.round(40 * baseIntensity),
        Math.round(20 * baseIntensity),
        Math.round(40 * baseIntensity),
        Math.round(20 * baseIntensity)
      ];
    
    case HapticPattern.ERROR:
      // Long pulse
      return Math.round(50 * baseIntensity);
    
    case HapticPattern.SELECTION:
      // Quick tap
      return Math.round(5 * baseIntensity);
    
    case HapticPattern.IMPACT:
      // Strong pulse with decay
      return [
        Math.round(40 * baseIntensity),
        Math.round(20 * baseIntensity),
        Math.round(10 * baseIntensity)
      ];
    
    case HapticPattern.NOTIFICATION:
      // Pattern similar to notification
      return [
        Math.round(25 * baseIntensity),
        Math.round(100 * baseIntensity),
        Math.round(25 * baseIntensity)
      ];
    
    default:
      return Math.round(15 * baseIntensity);
  }
}

/**
 * Get iOS-specific haptic type
 */
export function getIOSHapticType(pattern: HapticPatternType): string {
  switch (pattern) {
    case HapticPattern.LIGHT:
      return 'UIImpactFeedbackStyleLight';
    case HapticPattern.MEDIUM:
      return 'UIImpactFeedbackStyleMedium';
    case HapticPattern.HEAVY:
      return 'UIImpactFeedbackStyleHeavy';
    case HapticPattern.SUCCESS:
      return 'UINotificationFeedbackTypeSuccess';
    case HapticPattern.WARNING:
      return 'UINotificationFeedbackTypeWarning';
    case HapticPattern.ERROR:
      return 'UINotificationFeedbackTypeError';
    case HapticPattern.SELECTION:
      return 'UISelectionFeedbackChanged';
    case HapticPattern.IMPACT:
      return 'UIImpactFeedbackStyleRigid';
    case HapticPattern.NOTIFICATION:
      return 'UINotificationFeedbackTypeSuccess';
    default:
      return 'UIImpactFeedbackStyleMedium';
  }
}

/**
 * Get gamepad vibration parameters
 */
export function getGamepadVibration(pattern: HapticPatternType, intensity: number = 1.0) {
  const baseIntensity = Math.min(Math.max(intensity, 0), 1.0);
  
  switch (pattern) {
    case HapticPattern.LIGHT:
      return {
        duration: 50,
        weakMagnitude: 0.1 * baseIntensity,
        strongMagnitude: 0
      };
    
    case HapticPattern.MEDIUM:
      return {
        duration: 100,
        weakMagnitude: 0.3 * baseIntensity,
        strongMagnitude: 0.1 * baseIntensity
      };
    
    case HapticPattern.HEAVY:
      return {
        duration: 150,
        weakMagnitude: 0.5 * baseIntensity,
        strongMagnitude: 0.3 * baseIntensity
      };
    
    case HapticPattern.SUCCESS:
      return {
        duration: 200,
        weakMagnitude: 0.2 * baseIntensity,
        strongMagnitude: 0.1 * baseIntensity
      };
    
    case HapticPattern.WARNING:
      return {
        duration: 300,
        weakMagnitude: 0.4 * baseIntensity,
        strongMagnitude: 0.2 * baseIntensity
      };
    
    case HapticPattern.ERROR:
      return {
        duration: 400,
        weakMagnitude: 0.6 * baseIntensity,
        strongMagnitude: 0.4 * baseIntensity
      };
    
    case HapticPattern.SELECTION:
      return {
        duration: 30,
        weakMagnitude: 0.2 * baseIntensity,
        strongMagnitude: 0
      };
    
    case HapticPattern.IMPACT:
      return {
        duration: 100,
        weakMagnitude: 0.8 * baseIntensity,
        strongMagnitude: 0.6 * baseIntensity
      };
    
    case HapticPattern.NOTIFICATION:
      return {
        duration: 250,
        weakMagnitude: 0.3 * baseIntensity,
        strongMagnitude: 0.2 * baseIntensity
      };
    
    default:
      return {
        duration: 100,
        weakMagnitude: 0.3 * baseIntensity,
        strongMagnitude: 0.1 * baseIntensity
      };
  }
}