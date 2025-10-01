import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const LinkIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M10 13C10.91 14.08 12.34 14.71 13.88 14.59C15.41 14.47 16.77 13.62 17.54 12.33C18.31 11.04 18.41 9.48 17.81 8.11C17.21 6.73 15.97 5.71 14.52 5.39C13.07 5.07 11.57 5.49 10.5 6.5L7 10C5.76 11.24 5.34 13.08 5.89 14.76C6.45 16.43 7.89 17.67 9.62 17.96C11.35 18.25 13.04 17.55 14.07 16.15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11C13.09 9.92 11.66 9.29 10.12 9.41C8.59 9.53 7.23 10.38 6.46 11.67C5.69 12.96 5.59 14.52 6.19 15.89C6.79 17.27 8.03 18.29 9.48 18.61C10.93 18.93 12.43 18.51 13.5 17.5L17 14C18.24 12.76 18.66 10.92 18.11 9.24C17.55 7.57 16.11 6.33 14.38 6.04C12.65 5.75 10.96 6.45 9.93 7.85"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
};