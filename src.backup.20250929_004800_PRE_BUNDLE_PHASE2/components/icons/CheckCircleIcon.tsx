import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const CheckCircleIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M9 12L11 14L15 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
};