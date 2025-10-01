import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const ItalicIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <line x1="19" y1="4" x2="10" y2="4"/>
    <line x1="14" y1="20" x2="5" y2="20"/>
    <line x1="15" y1="4" x2="9" y2="20"/>
  </IconBase>
);

export default ItalicIcon;
