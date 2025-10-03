/**
 * XIcon Component - Close/Cancel X icon
 *
 * Features:
 * - Clean SVG X/close icon design
 * - Accessible with proper ARIA labels
 * - Customizable size and color
 * - Dark mode support
 * - Multiple variants (standard, bold, minimal)
 */

import React from 'react';

export interface XIconProps {
  size?: number | string;
  color?: string;
  className?: string;
  'aria-label'?: string;
  variant?: 'standard' | 'bold' | 'minimal';
}

export function XIcon({
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel = 'Close',
  variant = 'standard'
}: XIconProps): React.JSX.Element {
  const strokeWidth = variant === 'bold' ? '3' : variant === 'minimal' ? '1.5' : '2';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label={ariaLabel}
      role="img"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// Alternative close icon with circle background
export function CloseCircleIcon({
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel = 'Close'
}: XIconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label={ariaLabel}
      role="img"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

// Cancel icon (X with square background)
export function CancelIcon({
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel = 'Cancel'
}: XIconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label={ariaLabel}
      role="img"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  );
}

// Minimal close icon (just the X, thinner lines)
export function MinimalCloseIcon({
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel = 'Close'
}: XIconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label={ariaLabel}
      role="img"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default XIcon;