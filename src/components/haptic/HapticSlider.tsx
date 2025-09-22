/**
 * Haptic Slider Component
 * World-class slider with precision haptic feedback
 */

import React, { useEffect, memo, useRef, useCallback } from 'react';
import { useHapticFeedback, HapticPattern } from '../../hooks/useHapticFeedback';
import { hapticButtonService } from '../../services/haptic/hapticButtonService';
import { useLogger } from '../services/ServiceProvider';

interface HapticSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hapticSteps?: number;
  hapticDisabled?: boolean;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * Premium slider with stepped haptic feedback
 */
export const HapticSlider = memo(function HapticSlider({ value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  hapticSteps = 10,
  hapticDisabled = false,
  className = '',
  disabled = false,
  'aria-label': ariaLabel
 }: HapticSliderProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('HapticSlider component initialized', {
      componentName: 'HapticSlider'
    });
  }, []);

  const { trigger } = useHapticFeedback();
  const lastHapticValue = useRef(value);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    
    if (!disabled && !hapticDisabled) {
      const shouldTrigger = hapticButtonService.shouldTriggerSliderHaptic(
        newValue,
        lastHapticValue.current,
        min,
        max,
        hapticSteps
      );
      
      if (shouldTrigger) {
        await trigger(HapticPattern.SELECTION);
        lastHapticValue.current = newValue;
      }
    }
    
    onChange(newValue);
  }, [disabled, hapticDisabled, hapticSteps, max, min, onChange, trigger]);

  const sliderClasses = hapticButtonService.getSliderClasses(disabled, className);

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      className={sliderClasses}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
    />
  );
});