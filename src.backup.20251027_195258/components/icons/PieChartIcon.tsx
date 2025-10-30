import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const PieChartIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M21.21 15.89C19.6 19.04 16.71 21.05 13.29 21.53C9.87 22.01 6.47 20.92 4.05 18.6C1.63 16.28 0.5 12.97 0.95 9.65C1.4 6.33 3.36 3.48 6.29 1.9C9.22 0.32 12.77 0.17 15.84 1.52C18.91 2.87 21.15 5.54 21.91 8.77C21.94 8.91 21.96 9.06 21.97 9.21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 2V12L21.21 15.89"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
};