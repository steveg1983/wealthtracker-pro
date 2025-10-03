import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const GlobeIcon: React.FC<IconProps> = (props) => {
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
        d="M2 12H22"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 2C14.5 2 16.5 5.5 16.5 12C16.5 18.5 14.5 22 12 22C9.5 22 7.5 18.5 7.5 12C7.5 5.5 9.5 2 12 2Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </IconBase>
  );
};