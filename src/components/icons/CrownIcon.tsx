import React from 'react';
import type { IconProps } from './IconBase';

export function CrownIcon({ size = 24, className = '', color = 'currentColor' }: IconProps): React.JSX.Element {
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
      <path d="M2 20h20l-2-6-4 2-4-4-4 4-4-2z" />
      <circle cx="6" cy="4" r="2" />
      <circle cx="12" cy="2" r="2" />
      <circle cx="18" cy="4" r="2" />
    </svg>
  );
}
