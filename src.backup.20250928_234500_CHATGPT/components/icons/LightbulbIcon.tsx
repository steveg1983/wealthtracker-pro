import React from 'react';

interface LightbulbIconProps {
  size?: number;
  className?: string;
}

export function LightbulbIcon({ size = 24, className = '' }: LightbulbIconProps) {
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
      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7Z" />
      <path d="M8 21h8" />
      <path d="M10 17h4" />
    </svg>
  );
}