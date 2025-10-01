import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const SelectAllIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 12l2 2 4-4" />
    </IconBase>
  );
};