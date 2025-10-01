import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const FilterIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M22 3H2L10 12.46V19L14 21V12.46L22 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
};