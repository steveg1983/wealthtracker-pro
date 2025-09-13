/**
 * Haptic Toggle Component
 * World-class toggle switch with iOS-level haptic feedback
 */

import React, { useEffect, memo, useCallback } from 'react';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { hapticButtonService } from '../../services/haptic/hapticButtonService';
import { logger } from '../../services/loggingService';

interface HapticToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  hapticDisabled?: boolean;
  className?: string;
  disabled?: boolean;
}

/**
 * Premium toggle switch with haptic feedback
 */
export const HapticToggle = memo(function HapticToggle({
  checked,
  onChange,
  label,
  hapticDisabled = false,
  className = '',
  disabled = false
}: HapticToggleProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('HapticToggle component initialized', {
      componentName: 'HapticToggle'
    });
  }, []);

  const { trigger } = useHapticFeedback();

  const handleToggle = useCallback(async () => {
    if (!disabled && !hapticDisabled) {
      const pattern = hapticButtonService.getToggleHapticPattern(checked);
      await trigger(pattern);
    }
    onChange(!checked);
  }, [checked, disabled, hapticDisabled, onChange, trigger]);

  const buttonClasses = hapticButtonService.getToggleClasses(checked, disabled, className);
  const thumbClasses = hapticButtonService.getToggleThumbClasses(checked);

  return (
    <button
      type="button"
      className={buttonClasses}
      onClick={handleToggle}
      disabled={disabled}
      aria-pressed={checked}
      aria-label={label}
      role="switch"
    >
      <span className={thumbClasses} />
    </button>
  );
});