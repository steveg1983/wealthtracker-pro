import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export function ComputerIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}