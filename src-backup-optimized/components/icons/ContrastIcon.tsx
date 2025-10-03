import React from 'react';
import type { IconProps } from './IconBase';

export const ContrastIcon: React.FC<IconProps> = ({ size = 24, className = '' }: IconProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 0 0 20V2z" fill="currentColor" stroke="none" />
    </svg>
  );
};
