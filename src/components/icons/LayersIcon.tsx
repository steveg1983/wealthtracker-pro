import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export function LayersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2 2 7v10l10 5 10-5V7l-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}