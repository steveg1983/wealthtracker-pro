import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const CreditCardIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <rect
        x="2"
        y="5"
        width="20"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M2 10H22"
        stroke="currentColor"
        strokeWidth="2"
      />
    </IconBase>
  );
};