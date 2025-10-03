import React from 'react';
import { IconBase, IconProps } from './IconBase';

export function ToggleRightIcon({ size = 20, className, ...props }: IconProps) {
  return (
    <IconBase size={size} className={className} viewBox="0 0 24 24" {...props}>
      <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
      <circle cx="16" cy="12" r="3" />
    </IconBase>
  );
}