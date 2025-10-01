import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const BanknoteIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <rect
        x="2"
        y="6"
        width="20"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M6 6V18"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M18 6V18"
        stroke="currentColor"
        strokeWidth="2"
      />
    </IconBase>
  );
};