import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const UndoIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path d="M9 14L4 9l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </IconBase>
  );
};