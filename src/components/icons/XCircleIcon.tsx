import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const XCircleIcon: React.FC<IconProps> = (props) => {
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
        d="M15 9L9 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9 9L15 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
};