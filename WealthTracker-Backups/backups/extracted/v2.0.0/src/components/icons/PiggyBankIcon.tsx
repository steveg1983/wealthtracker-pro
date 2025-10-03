import React from 'react';
import { IconBase } from './IconBase';
import type { IconProps } from './IconBase';

export const PiggyBankIcon: React.FC<IconProps> = (props) => {
  return (
    <IconBase {...props}>
      <path
        d="M19 5C19 3.9 18.1 3 17 3H7L9 1H15L16.5 2.5C17.05 2.05 17.76 1.78 18.5 1.78C20.04 1.78 21.3 3.04 21.3 4.58C21.3 5.28 21.05 5.94 20.63 6.46L20 7.13V11.91C20.32 11.96 20.64 12 21 12C21.55 12 22 12.45 22 13V16C22 16.55 21.55 17 21 17H20V19C20 20.1 19.1 21 18 21H16C14.9 21 14 20.1 14 19V18H8V19C8 20.1 7.1 21 6 21H4C2.9 21 2 20.1 2 19V17C1.45 17 1 16.55 1 16V10C1 7.24 3.24 5 6 5H19Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="15.5"
        cy="10.5"
        r="1.5"
        fill="currentColor"
      />
    </IconBase>
  );
};