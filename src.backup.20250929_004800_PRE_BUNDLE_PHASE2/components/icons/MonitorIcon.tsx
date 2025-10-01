import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const MonitorIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <rect
        x="2"
        y="3"
        width="20"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M8 21H16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 17V21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
};