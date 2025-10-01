import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const EyeOffIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M17.94 17.94C16.23 19.243 14.12 20 12 20C5 20 1 12 1 12C2.24 9.68 3.79 7.62 5.64 6.05M9.13 9.13C9.47 8.57 10.02 8.14 10.67 7.92C11.32 7.7 12.02 7.7 12.68 7.92C13.33 8.14 13.88 8.57 14.22 9.13C14.56 9.69 14.68 10.35 14.56 10.99C14.44 11.62 14.09 12.19 13.58 12.58C13.07 12.97 12.44 13.16 11.8 13.11C11.16 13.06 10.56 12.77 10.13 12.31C9.69 11.85 9.44 11.25 9.42 10.61C9.4 9.98 9.61 9.36 10.01 8.87L9.13 9.13Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1 1L23 23"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 4C18.5 4 23 12 23 12C22.39 13.07 21.64 14.05 20.77 14.93"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
};