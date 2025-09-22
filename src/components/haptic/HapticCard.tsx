/**
 * Haptic Card Component
 * World-class pressable card with haptic feedback
 */

import React, { useEffect, memo, useCallback } from 'react';
import { useHapticFeedback, HapticPattern, HapticPatternType } from '../../hooks/useHapticFeedback';
import { hapticButtonService } from '../../services/haptic/hapticButtonService';
import { useLogger } from '../services/ServiceProvider';

interface HapticCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  hapticPattern?: HapticPatternType;
  hapticDisabled?: boolean;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * Premium card with press haptic feedback
 */
export const HapticCard = memo(function HapticCard({ children,
  onClick,
  hapticPattern = HapticPattern.LIGHT,
  hapticDisabled = false,
  className = '',
  disabled = false,
  'aria-label': ariaLabel
 }: HapticCardProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('HapticCard component initialized', {
      componentName: 'HapticCard'
    });
  }, []);

  const { trigger } = useHapticFeedback();

  const handleClick = useCallback(async () => {
    if (!disabled && !hapticDisabled && onClick) {
      await trigger(hapticPattern);
      onClick();
    }
  }, [disabled, hapticDisabled, hapticPattern, onClick, trigger]);

  const classes = hapticButtonService.getCardClasses(!!onClick, disabled, className);

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        onClick={handleClick}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={classes} aria-label={ariaLabel}>
      {children}
    </div>
  );
});