import React from 'react';
import { IconBase, IconProps } from './IconBase';

export const ImageIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="9" cy="9" r="2"/>
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
  </IconBase>
);

export default ImageIcon;
