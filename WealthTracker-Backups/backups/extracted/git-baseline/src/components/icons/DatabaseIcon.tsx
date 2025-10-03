import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const DatabaseIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <ellipse
        cx="12"
        cy="5"
        rx="9"
        ry="3"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M21 12C21 13.66 17 15 12 15C7 15 3 13.66 3 12"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M3 5V19C3 20.66 7 22 12 22C17 22 21 20.66 21 19V5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M21 12V19"
        stroke="currentColor"
        strokeWidth="2"
      />
    </IconBase>
  );
};