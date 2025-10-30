/**
 * Touch target React components
 * Components for ensuring minimum touch target sizes for mobile usability
 */

import React from 'react';
import { useTouchTarget } from './touchTargetConstants';

/**
 * Component wrapper to ensure touch target compliance
 */
interface TouchTargetProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

export default function TouchTarget({
  children,
  className = '',
  onClick,
  disabled,
  as: Component = 'button'
}: TouchTargetProps): React.JSX.Element {
  const touchClasses = useTouchTarget(className);

  const elementProps: Record<string, unknown> = {
    className: touchClasses
  };

  if (Component === 'button') {
    elementProps.type = 'button';
    if (typeof disabled === 'boolean') {
      elementProps.disabled = disabled;
    }
    if (onClick && !disabled) {
      elementProps.onClick = onClick;
    }
  } else if (onClick && !disabled) {
    elementProps.onClick = onClick;
  }

  return React.createElement(Component, elementProps, children);
}
