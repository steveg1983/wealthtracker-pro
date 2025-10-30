import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const GoalIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M12 13V19M12 19L9 16M12 19L15 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.34 11C3.12 10.02 3 9.01 3 8C3 4.13 6.13 1 10 1C13.87 1 17 4.13 17 8C17 9.01 16.88 10.02 16.66 11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M21 8L23 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M1 8L3 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="12"
        cy="8"
        r="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </IconBase>
  );
};