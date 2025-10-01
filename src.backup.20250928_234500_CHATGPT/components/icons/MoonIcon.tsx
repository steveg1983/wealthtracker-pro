import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const MoonIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M21 12.79C20.5 18.2 16.09 22.31 10.69 21.81C5.29 21.31 1.18 16.9 1.68 11.5C2.18 6.09 6.59 1.98 11.99 2.48C12.25 2.5 12.51 2.53 12.76 2.57C11.67 3.99 11.33 5.82 11.84 7.51C12.34 9.21 13.64 10.51 15.34 11.01C17.03 11.52 18.86 11.18 20.28 10.09C20.32 10.34 20.35 10.6 20.37 10.86C20.46 11.52 20.46 12.16 20.37 12.82L21 12.79Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
};