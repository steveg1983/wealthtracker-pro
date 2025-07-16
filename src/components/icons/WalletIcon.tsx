import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const WalletIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M20 12V8H7C5.9 8 5 7.1 5 6C5 4.9 5.9 4 7 4H20V3C20 2.45 19.55 2 19 2H5C3.35 2 2 3.35 2 5V19C2 20.65 3.35 22 5 22H19C19.55 22 20 21.55 20 21V20H7C5.9 20 5 19.1 5 18V12H20Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 12H22V16H20C18.9 16 18 15.1 18 14C18 12.9 18.9 12 20 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
};