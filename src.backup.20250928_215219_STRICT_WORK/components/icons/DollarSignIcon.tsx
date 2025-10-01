import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export function DollarSignIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}