import React from 'react';
import type { IconProps } from './IconBase';

export function PalmtreeIcon({ size = 24, className = '', color = 'currentColor' }: IconProps): React.JSX.Element {
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
    >
      <path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h11z" />
      <path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-9z" />
      <path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25z" />
      <path d="M11 15.5c2.15 2.15 5.47 1.8 7.43-.35L14.18 11z" />
      <path d="M8 18a4 4 0 0 0 4 4 4 4 0 0 0 4-4" />
      <path d="M12 12v10" />
    </svg>
  );
}
