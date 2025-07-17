import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export function MagicWandIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M15 4V2m0 2v2m0-2h2m-2 0h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 9L3 3l6 6zm0 0l6 6-6-6zm0 0l-6 6 6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12h-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 6h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 18h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}