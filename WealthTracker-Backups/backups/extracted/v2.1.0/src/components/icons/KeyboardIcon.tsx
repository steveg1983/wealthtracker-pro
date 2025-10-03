import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export function KeyboardIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M6 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 12h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 12h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 16h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}