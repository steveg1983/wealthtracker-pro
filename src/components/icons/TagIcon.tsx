import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const TagIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M20.59 13.41L13.42 20.58C13.18 20.82 12.84 20.96 12.5 20.96C12.16 20.96 11.82 20.82 11.58 20.58L2.96 11.96C2.71 11.71 2.58 11.37 2.58 11.02V4.5C2.58 3.67 3.25 3 4.08 3H10.6C10.95 3 11.29 3.13 11.54 3.38L20.16 12C20.41 12.25 20.54 12.59 20.54 12.93C20.54 13.27 20.41 13.61 20.16 13.86L20.59 13.41Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="7.5"
        cy="7.5"
        r="1.5"
        fill="currentColor"
      />
    </IconBase>
  );
};