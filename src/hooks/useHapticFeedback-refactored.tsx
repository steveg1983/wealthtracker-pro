/**
 * @component useHapticFeedback
 * @description World-class haptic feedback hook providing cross-platform haptic
 * feedback with intelligent fallbacks and user preference management. Supports
 * iOS, Android, Web, and Gamepad vibration APIs.
 * 
 * @example
 * ```tsx
 * const { trigger, isEnabled, toggle } = useHapticFeedback();
 * 
 * // Trigger haptic on button press
 * <button onClick={() => trigger(HapticPattern.LIGHT)}>
 *   Click Me
 * </button>
 * ```
 * 
 * @features
 * - Cross-platform support
 * - Multiple haptic patterns
 * - User preference management
 * - Visual fallback
 * - Gamepad support
 * - Debounced feedback
 * 
 * @performance
 * - Service-based architecture
 * - Cached preferences
 * - Reduced from 454 to ~100 lines
 * 
 * @accessibility
 * - Respects user preferences
 * - Visual fallback for deaf users
 * - No dependency on device capabilities
 */

import React, { useCallback, ReactNode } from 'react';
import { hapticService } from '../services/haptic/hapticService';
import { HapticPattern, HapticPatternType, HapticOptions } from '../services/haptic/hapticPatterns';
import { logger } from '../services/loggingService';

/**
 * Hook for haptic feedback
 */
export function useHapticFeedback() {
  // Check if haptic feedback is available
  const isHapticAvailable = useCallback((): boolean => {
    return hapticService.isAvailable();
  }, []);

  // Trigger haptic feedback
  const trigger = useCallback(async (
    pattern: HapticPatternType = HapticPattern.LIGHT,
    options: HapticOptions = {}
  ): Promise<void> => {
    await hapticService.trigger(pattern, options);
  }, []);

  // Enable haptic feedback
  const enable = useCallback((): void => {
    hapticService.enable();
  }, []);

  // Disable haptic feedback
  const disable = useCallback((): void => {
    hapticService.disable();
  }, []);

  // Toggle haptic feedback
  const toggle = useCallback((): boolean => {
    return hapticService.toggle();
  }, []);

  // Get enabled state
  const isEnabled = hapticService.getEnabled();

  return {
    trigger,
    isAvailable: isHapticAvailable,
    isEnabled,
    enable,
    disable,
    toggle
  };
}

/**
 * Haptic feedback wrapper component
 */
interface HapticWrapperProps {
  children: ReactNode;
  pattern?: HapticPatternType;
  options?: HapticOptions;
  /** Trigger on click */
  onClick?: boolean;
  /** Trigger on touch start */
  onTouchStart?: boolean;
  /** Trigger on focus */
  onFocus?: boolean;
  /** Trigger on hover */
  onHover?: boolean;
}

export const HapticWrapper = React.memo(function HapticWrapper({
  children,
  pattern = HapticPattern.LIGHT,
  options = {},
  onClick = true,
  onTouchStart = false,
  onFocus = false,
  onHover = false
}: HapticWrapperProps) {
  const { trigger } = useHapticFeedback();

  const handleClick = useCallback(() => {
    if (onClick) trigger(pattern, options);
  }, [onClick, pattern, options, trigger]);

  const handleTouchStart = useCallback(() => {
    if (onTouchStart) trigger(pattern, options);
  }, [onTouchStart, pattern, options, trigger]);

  const handleFocus = useCallback(() => {
    if (onFocus) trigger(pattern, options);
  }, [onFocus, pattern, options, trigger]);

  const handleMouseEnter = useCallback(() => {
    if (onHover) trigger(pattern, options);
  }, [onHover, pattern, options, trigger]);

  return (
    <div
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onFocus={handleFocus}
      onMouseEnter={handleMouseEnter}
      style={{ display: 'contents' }}
    >
      {children}
    </div>
  );
});

/**
 * HOC for adding haptic feedback to components
 */
export function withHapticFeedback<P extends object>(
  Component: React.ComponentType<P>,
  defaultPattern: HapticPatternType = HapticPattern.LIGHT,
  defaultOptions: HapticOptions = {}
): React.ComponentType<P & { hapticPattern?: HapticPatternType; hapticOptions?: HapticOptions }> {
  return React.memo(function WithHapticFeedback(props: P & { 
    hapticPattern?: HapticPatternType; 
    hapticOptions?: HapticOptions 
  }) {
    const { hapticPattern = defaultPattern, hapticOptions = defaultOptions, ...componentProps } = props;
    
    return (
      <HapticWrapper pattern={hapticPattern} options={hapticOptions}>
        <Component {...(componentProps as P)} />
      </HapticWrapper>
    );
  });
}

// Re-export types for convenience
export { HapticPattern, HapticOptions } from '../services/haptic/hapticService';

export default useHapticFeedback;