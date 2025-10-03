/**
 * InfoIcon Component - Information circle icon
 */

import React from 'react';

interface InfoIconProps {
  size?: number;
  className?: string;
  color?: string;
}

export function InfoIcon({
  size = 24,
  className = '',
  color = 'currentColor'
}: InfoIconProps): React.JSX.Element {
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
      <circle cx="12" cy="12" r="10" />
      <path d="m9,9 3,-3 3,3" />
      <path d="m9,15 3,3 3,-3" />
      <line x1="12" y1="9" x2="12" y2="15" />
    </svg>
  );
}

export default InfoIcon;