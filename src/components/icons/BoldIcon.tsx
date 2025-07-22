import React from 'react';
import { IconBase, IconProps } from './IconBase';

export const BoldIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
    <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
  </IconBase>
);

export default BoldIcon;
