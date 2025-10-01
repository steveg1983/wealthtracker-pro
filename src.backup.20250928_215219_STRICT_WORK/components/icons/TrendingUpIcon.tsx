import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const TrendingUpIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M22 7L13.5 15.5L8.5 10.5L2 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 7H22V13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
};