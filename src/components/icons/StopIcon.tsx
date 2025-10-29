import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const StopIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="6" y="6" width="12" height="12" rx="2" ry="2"/>
  </IconBase>
);