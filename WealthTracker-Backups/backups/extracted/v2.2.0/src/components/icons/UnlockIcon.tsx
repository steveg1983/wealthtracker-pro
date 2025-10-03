import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const UnlockIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path 
        d="M7 11V7C7 4.23858 9.23858 2 12 2C14.419 2 16.4367 3.71776 16.9 6M5 11H19C19.5523 11 20 11.4477 20 12V20C20 20.5523 19.5523 21 19 21H5C4.44772 21 4 20.5523 4 20V12C4 11.4477 4.44772 11 5 11Z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </IconBase>
  );
};