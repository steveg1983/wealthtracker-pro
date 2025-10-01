import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const PlusCircleIcon: React.FC<IconProps> = (props) => {
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
      <path
        d="M12 8V16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 12H16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconBase>
  );
};