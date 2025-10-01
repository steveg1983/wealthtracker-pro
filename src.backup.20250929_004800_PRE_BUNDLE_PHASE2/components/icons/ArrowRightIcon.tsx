import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const ArrowRightIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M5 12H19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 5L19 12L12 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
};