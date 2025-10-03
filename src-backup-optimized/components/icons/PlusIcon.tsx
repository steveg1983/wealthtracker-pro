/**
 * PlusIcon Component - Plus/add icon
 */

import React from 'react';

interface PlusIconProps {
  size?: number;
  className?: string;
  color?: string;
}

export function PlusIcon({
  size = 24,
  className = '',
  color = 'currentColor'
}: PlusIconProps): React.JSX.Element {
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export default PlusIcon;