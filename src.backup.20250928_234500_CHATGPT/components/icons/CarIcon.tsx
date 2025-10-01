import React from 'react';

interface CarIconProps {
  size?: number;
  className?: string;
}

export default function CarIcon({ size = 24, className = '' }: CarIconProps) {
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
      <path d="M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" />
      <path d="M15 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" />
      <path d="M5 17H3s-1-1.5-1-3 1-3 1-3l1.5-3h9S15 8 15 10v2M7 10v4h6v-4" />
    </svg>
  );
}