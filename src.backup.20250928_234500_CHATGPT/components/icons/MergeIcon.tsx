import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const MergeIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path d="M18 21v-7a4 4 0 0 0-4-4H6" />
      <path d="M3 18l3 3 3-3" />
      <path d="M6 3v7a4 4 0 0 0 4 4h8" />
      <path d="M21 6l-3-3-3 3" />
    </IconBase>
  );
};