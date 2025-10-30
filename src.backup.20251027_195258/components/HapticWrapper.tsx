import React from 'react';
import useHapticFeedback, {
  HAPTIC_PATTERN,
  type HapticOptions,
  type HapticPattern,
} from '../hooks/useHapticFeedback';

interface HapticWrapperProps {
  children: React.ReactElement<React.DOMAttributes<unknown>>;
  pattern?: HapticPattern;
  trigger?: 'click' | 'focus' | 'hover' | 'touchstart';
  options?: HapticOptions;
  disabled?: boolean;
}

export function HapticWrapper({
  children,
  pattern = HAPTIC_PATTERN.LIGHT,
  trigger = 'click',
  options = {},
  disabled = false,
}: HapticWrapperProps): React.ReactElement | null {
  const { trigger: triggerHaptic } = useHapticFeedback();

  const childProps = children.props as React.DOMAttributes<unknown>;

  if (disabled) {
    return children;
  }

  const wrapHandler = <E,>(original?: (event: E) => void, callback?: (event: E) => void) =>
    (event: E) => {
      callback?.(event);
      original?.(event);
    };

  switch (trigger) {
    case 'focus':
      return React.cloneElement(children, {
        onFocus: wrapHandler(childProps.onFocus, () => {
          void triggerHaptic(pattern, options);
        }),
      });
    case 'hover':
      return React.cloneElement(children, {
        onMouseEnter: wrapHandler(childProps.onMouseEnter, () => {
          void triggerHaptic(pattern, options);
        }),
      });
    case 'touchstart':
      return React.cloneElement(children, {
        onTouchStart: wrapHandler(childProps.onTouchStart, () => {
          void triggerHaptic(pattern, options);
        }),
      });
    case 'click':
    default:
      return React.cloneElement(children, {
        onClick: wrapHandler(childProps.onClick, () => {
          void triggerHaptic(pattern, options);
        }),
      });
  }
}
