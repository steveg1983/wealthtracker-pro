import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const RefreshCwIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M21 2V8H15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 12C3 15.18 4.58 18.03 7.11 19.62C9.64 21.21 12.74 21.38 15.42 20.09"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M21 12C21 8.82 19.42 5.97 16.89 4.38C14.36 2.79 11.26 2.62 8.58 3.91"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M3 22V16H9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 8L18.44 5.44C17.56 4.56 16.51 3.87 15.35 3.41"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M3 16L5.56 18.56C6.44 19.44 7.49 20.13 8.65 20.59"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
};