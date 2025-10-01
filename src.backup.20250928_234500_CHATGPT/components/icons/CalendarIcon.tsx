import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const CalendarIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <rect
        x="3"
        y="4"
        width="18"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M16 2V6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 2V6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M3 10H21"
        stroke="currentColor"
        strokeWidth="2"
      />
    </IconBase>
  );
};