/**
 * @module hapticService
 * @description Enterprise-grade haptic feedback service providing cross-platform
 * haptic feedback with fallback mechanisms and user preference management.
 * 
 * @features
 * - Cross-platform support (iOS, Android, Web)
 * - Gamepad vibration support
 * - User preference management
 * - Fallback mechanisms
 * 
 * @performance
 * - Singleton pattern
 * - Debounced feedback
 * - Cached preferences
 */

import { lazyLogger as logger } from '../serviceFactory';
import { 
  HapticPattern,
  HapticPatternType, 
  HapticOptions,
  getVibrationPattern,
  getIOSHapticType,
  getGamepadVibration 
} from './hapticPatterns';

/**
 * Haptic feedback service
 */
class HapticService {
  private static instance: HapticService;
  private isEnabled: boolean = true;
  private lastHapticTime: number = 0;
  private minInterval: number = 50; // Minimum ms between haptics

  private constructor() {
    this.loadPreferences();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): HapticService {
    if (!HapticService.instance) {
      HapticService.instance = new HapticService();
    }
    return HapticService.instance;
  }

  /**
   * Load user preferences
   */
  private loadPreferences(): void {
    try {
      const stored = localStorage.getItem('hapticEnabled');
      this.isEnabled = stored !== 'false';
    } catch (error) {
      logger.error('Failed to load haptic preferences', error);
    }
  }

  /**
   * Save user preferences
   */
  private savePreferences(): void {
    try {
      localStorage.setItem('hapticEnabled', String(this.isEnabled));
    } catch (error) {
      logger.error('Failed to save haptic preferences', error);
    }
  }

  /**
   * Check if haptic feedback is available
   */
  isAvailable(): boolean {
    // iOS Haptic Feedback API
    if ('navigator' in window && 'vibrate' in navigator) return true;
    
    // iOS specific haptic feedback (iOS 10+)
    if (window.DeviceMotionEvent && typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      return true;
    }
    
    // Check for gamepad API
    if ('getGamepads' in navigator) {
      const gamepads = navigator.getGamepads();
      for (const gamepad of gamepads) {
        if (gamepad?.vibrationActuator) return true;
      }
    }
    
    return false;
  }

  /**
   * Enable haptic feedback
   */
  enable(): void {
    this.isEnabled = true;
    this.savePreferences();
    logger.info('Haptic feedback enabled');
  }

  /**
   * Disable haptic feedback
   */
  disable(): void {
    this.isEnabled = false;
    this.savePreferences();
    logger.info('Haptic feedback disabled');
  }

  /**
   * Toggle haptic feedback
   */
  toggle(): boolean {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.isEnabled;
  }

  /**
   * Check if haptic is enabled
   */
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Trigger haptic feedback
   */
  async trigger(pattern: HapticPatternType = HapticPattern.LIGHT, options: HapticOptions = {}): Promise<void> {
    // Check if should trigger
    if (!this.isEnabled && !options.force) return;
    if (!this.isAvailable()) return;

    // Debounce rapid haptics
    const now = Date.now();
    if (now - this.lastHapticTime < this.minInterval) return;
    this.lastHapticTime = now;

    // Apply delay if specified
    if (options.delay) {
      await new Promise(resolve => setTimeout(resolve, options.delay));
    }

    const intensity = options.intensity ?? 1.0;

    try {
      // Try Web Vibration API first
      if ('vibrate' in navigator) {
        const vibrationPattern = getVibrationPattern(pattern, intensity);
        navigator.vibrate(vibrationPattern);
        logger.debug('Haptic triggered via Web Vibration API', { pattern, intensity });
        return;
      }

      // Try iOS-specific haptic
      if (this.triggerIOSHaptic(pattern)) {
        logger.debug('Haptic triggered via iOS API', { pattern });
        return;
      }

      // Try gamepad vibration
      if (this.triggerGamepadVibration(pattern, intensity)) {
        logger.debug('Haptic triggered via Gamepad API', { pattern, intensity });
        return;
      }

      // Fallback: Visual feedback
      this.triggerVisualFeedback(pattern);
      logger.debug('Haptic fallback to visual feedback', { pattern });

    } catch (error) {
      logger.error('Failed to trigger haptic feedback', error);
    }
  }

  /**
   * Trigger iOS-specific haptic feedback
   */
  private triggerIOSHaptic(pattern: HapticPatternType): boolean {
    // Check for iOS webkit message handler
    if ((window as any).webkit?.messageHandlers?.haptic) {
      try {
        (window as any).webkit.messageHandlers.haptic.postMessage({
          type: getIOSHapticType(pattern)
        });
        return true;
      } catch (error) {
        logger.debug('iOS haptic not available', error);
      }
    }
    return false;
  }

  /**
   * Trigger gamepad vibration
   */
  private triggerGamepadVibration(pattern: HapticPatternType, intensity: number): boolean {
    try {
      const gamepads = navigator.getGamepads();
      for (const gamepad of gamepads) {
        if (gamepad?.vibrationActuator) {
          const params = getGamepadVibration(pattern, intensity);
          gamepad.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: params.duration,
            weakMagnitude: params.weakMagnitude,
            strongMagnitude: params.strongMagnitude
          });
          return true;
        }
      }
    } catch (error) {
      logger.debug('Gamepad vibration not available', error);
    }
    return false;
  }

  /**
   * Trigger visual feedback as fallback
   */
  private triggerVisualFeedback(pattern: HapticPatternType): void {
    // Create a subtle visual pulse effect
    const element = document.createElement('div');
    element.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 999999;
      background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.05) 100%);
      animation: haptic-pulse 200ms ease-out;
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes haptic-pulse {
        0% { opacity: 0; transform: scale(0.95); }
        50% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.05); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(element);

    // Clean up
    setTimeout(() => {
      element.remove();
      style.remove();
    }, 200);
  }
}

// Export singleton instance
export const hapticService = HapticService.getInstance();

// Export types for convenience
export { HapticPattern } from './hapticPatterns';
export type { HapticOptions } from './hapticPatterns';