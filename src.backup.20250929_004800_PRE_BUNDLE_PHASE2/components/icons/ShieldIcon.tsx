import React from 'react';
import type { IconProps } from './index';

export default function ShieldIcon({ size = 24, className }: IconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
    >
      <path 
        d="M12 2L4 7V11.09C4 14.14 5.41 17.85 7.86 20.3C9.08 21.52 10.54 22.5 12 22.5C13.46 22.5 14.92 21.52 16.14 20.3C18.59 17.85 20 14.14 20 11.09V7L12 2ZM18 11.09C18 13.52 16.81 16.58 14.73 18.66C13.68 19.71 12.64 20.5 12 20.5C11.36 20.5 10.32 19.71 9.27 18.66C7.19 16.58 6 13.52 6 11.09V8.39L12 4.39L18 8.39V11.09Z" 
        fill="currentColor"
      />
    </svg>
  );
}