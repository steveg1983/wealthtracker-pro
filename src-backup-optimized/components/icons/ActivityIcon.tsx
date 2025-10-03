/**
 * ActivityIcon Component - Icon for activity/performance displays
 *
 * Features:
 * - Clean SVG icon design
 * - Accessible with proper ARIA labels
 * - Customizable size and color
 * - Dark mode support
 */

import React from 'react';

export interface ActivityIconProps {
  size?: number | string;
  color?: string;
  className?: string;
  'aria-label'?: string;
}

export function ActivityIcon({
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel = 'Activity'
}: ActivityIconProps): React.JSX.Element {
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
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
    </svg>
  );
}

// Alternative activity icon with pulse design
export function ActivityPulseIcon({
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel = 'Activity Pulse'
}: ActivityIconProps): React.JSX.Element {
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
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      <path d="M12 5.67v15.56" />
    </svg>
  );
}

// Performance chart icon variation
export function PerformanceIcon({
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel = 'Performance Chart'
}: ActivityIconProps): React.JSX.Element {
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
      <path d="M3 3v18h18" />
      <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
    </svg>
  );
}

// Trending up icon for positive performance
export function TrendingUpIcon({
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel = 'Trending Up'
}: ActivityIconProps): React.JSX.Element {
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
      <polyline points="23,6 13.5,15.5 8.5,10.5 1,18" />
      <polyline points="17,6 23,6 23,12" />
    </svg>
  );
}

// Trending down icon for negative performance
export function TrendingDownIcon({
  size = 24,
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel = 'Trending Down'
}: ActivityIconProps): React.JSX.Element {
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
      <polyline points="23,18 13.5,8.5 8.5,13.5 1,6" />
      <polyline points="17,18 23,18 23,12" />
    </svg>
  );
}

export default ActivityIcon;