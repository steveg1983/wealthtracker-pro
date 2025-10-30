import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const CircleDotIcon: React.FC<IconProps> = (props) => {
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
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="currentColor"
      />
    </IconBase>
  );
};