import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const ShrinkIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M8 3V6C8 6.53043 7.78929 7.03914 7.41421 7.41421C7.03914 7.78929 6.53043 8 6 8H3M21 8H18C17.4696 8 16.9609 7.78929 16.5858 7.41421C16.2107 7.03914 16 6.53043 16 6V3M16 21V18C16 17.4696 16.2107 16.9609 16.5858 16.5858C16.9609 16.2107 17.4696 16 18 16H21M3 16H6C6.53043 16 7.03914 16.2107 7.41421 16.5858C7.78929 16.9609 8 17.4696 8 18V21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
};