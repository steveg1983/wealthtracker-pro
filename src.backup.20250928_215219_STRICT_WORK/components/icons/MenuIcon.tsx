import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const MenuIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M3 12H21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M3 6H21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M3 18H21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
};