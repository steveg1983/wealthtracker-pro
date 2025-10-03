import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const FolderIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </IconBase>
  );
};