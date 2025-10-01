import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const CodeIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <polyline points="16,18 22,12 16,6"/>
    <polyline points="8,6 2,12 8,18"/>
  </IconBase>
);

export default CodeIcon;
