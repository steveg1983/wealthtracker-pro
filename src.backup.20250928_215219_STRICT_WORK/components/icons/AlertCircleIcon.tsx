import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const AlertCircleIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M12 8V12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 16H12.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
};