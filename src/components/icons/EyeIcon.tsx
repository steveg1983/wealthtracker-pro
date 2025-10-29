import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const EyeIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M1 12S5 4 12 4S23 12 23 12S19 20 12 20S1 12 1 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </IconBase>
  );
};