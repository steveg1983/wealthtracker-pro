import type { ElementType } from 'react';

export interface MobileNavigationLink {
  to: string;
  icon: ElementType;
  label: string;
  subItems?: MobileNavigationLink[];
}

export type MobileNavigationLinks = MobileNavigationLink[];

export const DEFAULT_MOBILE_NAVIGATION_LINKS: MobileNavigationLinks = [];
