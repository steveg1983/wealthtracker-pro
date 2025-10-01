import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const BarChart3Icon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M18 20V10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 20V4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 20V14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
};