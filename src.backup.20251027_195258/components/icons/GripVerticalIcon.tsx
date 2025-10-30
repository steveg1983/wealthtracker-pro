import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const GripVerticalIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="5" r="1" fill="currentColor" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="9" cy="19" r="1" fill="currentColor" />
      <circle cx="15" cy="5" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="19" r="1" fill="currentColor" />
    </IconBase>
  );
};