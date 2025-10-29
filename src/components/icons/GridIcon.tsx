import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export function GridIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none" />
    </IconBase>
  );
}