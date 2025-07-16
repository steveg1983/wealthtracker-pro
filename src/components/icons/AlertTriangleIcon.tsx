import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const AlertTriangleIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M10.29 3.86L1.82 18C1.64 18.34 1.55 18.71 1.55 19.09C1.55 19.87 2.17 20.5 2.95 20.5H21.05C21.83 20.5 22.45 19.87 22.45 19.09C22.45 18.71 22.36 18.34 22.18 18L13.71 3.86C13.35 3.26 12.68 2.86 12 2.86C11.32 2.86 10.65 3.26 10.29 3.86Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 9V13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 17H12.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
};