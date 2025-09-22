/**
 * ArrowRightIcon Component - Right-pointing arrow icon
 *
 * Features:
 * - Clean SVG arrow design
 * - Accessible with proper ARIA labels
 * - Customizable size and color
 * - Dark mode support
 * - Multiple arrow styles and directions
 */

import React from 'react';

export interface ArrowIconProps {
  size?: number | string;
  color?: string;
  className?: string;
  'aria-label'?: string;
  variant?: 'standard' | 'bold' | 'minimal' | 'chevron';
}

export function ArrowRightIcon({
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel = 'Arrow Right',
  variant = 'standard'
}: ArrowIconProps): React.JSX.Element {
  const strokeWidth = variant === 'bold' ? '3' : variant === 'minimal' ? '1.5' : '2';

  if (variant === 'chevron') {
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
        <polyline points="9,18 15,12 9,6" />
      </svg>
    );
  }

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
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12,5 19,12 12,19" />
    </svg>
  );
}

export function ArrowLeftIcon({
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel = 'Arrow Left',
  variant = 'standard'
}: ArrowIconProps): React.JSX.Element {
  const strokeWidth = variant === 'bold' ? '3' : variant === 'minimal' ? '1.5' : '2';

  if (variant === 'chevron') {
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
        <polyline points="15,18 9,12 15,6" />
      </svg>
    );
  }

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
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12,19 5,12 12,5" />
    </svg>
  );
}

export function ArrowUpIcon({
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel = 'Arrow Up',
  variant = 'standard'
}: ArrowIconProps): React.JSX.Element {
  const strokeWidth = variant === 'bold' ? '3' : variant === 'minimal' ? '1.5' : '2';

  if (variant === 'chevron') {
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
        <polyline points="18,15 12,9 6,15" />
      </svg>
    );
  }

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
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5,12 12,5 19,12" />
    </svg>
  );
}

export function ArrowDownIcon({
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel = 'Arrow Down',
  variant = 'standard'
}: ArrowIconProps): React.JSX.Element {
  const strokeWidth = variant === 'bold' ? '3' : variant === 'minimal' ? '1.5' : '2';

  if (variant === 'chevron') {
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
        <polyline points="6,9 12,15 18,9" />
      </svg>
    );
  }

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
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="5,12 12,19 19,12" />
    </svg>
  );
}

// External link arrow (arrow going up and right)
export function ExternalLinkIcon({
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel = 'External Link'
}: ArrowIconProps): React.JSX.Element {
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
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15,3 21,3 21,9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export default ArrowRightIcon;