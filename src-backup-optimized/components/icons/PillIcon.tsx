import React from 'react';
import type { IconProps } from './IconBase';

export function PillIcon({ size = 24, className = '', color = 'currentColor' }: IconProps): React.JSX.Element {
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
      <path d="M10.827 16.379a6.082 6.082 0 0 1-8.618-8.618m0 0 9.19 9.19a6.082 6.082 0 0 0 8.619-8.619 M10.827 16.379l4.793-4.793 M7.621 13.173l4.793-4.793" />
    </svg>
  );
}
