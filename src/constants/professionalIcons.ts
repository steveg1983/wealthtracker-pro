import type { ComponentType } from 'react';
/**
 * Professional Icon Constants and Mappings
 */

export const ICON_CONFIG = {
  defaultSize: 24,
  defaultClass: 'icon',
  defaultColor: 'currentColor',
  size: 24,
  stroke: 2,
  className: 'icon'
} as const;

export type ProfessionalIconName =
  | 'dashboard'
  | 'accounts'
  | 'transactions'
  | 'budgets'
  | 'budget'
  | 'goals'
  | 'reports'
  | 'settings'
  | 'logout'
  | 'analytics'
  | 'calendar'
  | 'chart'
  | 'filter'
  | 'search'
  | 'add'
  | 'edit'
  | 'delete'
  | 'save'
  | 'cancel'
  | 'close'
  | 'check'
  | 'warning'
  | 'error'
  | 'info'
  | 'help'
  | 'menu'
  | 'export'
  | 'import'
  | 'download'
  | 'upload'
  | 'refresh'
  | 'sync'
  | 'lock'
  | 'unlock'
  | 'user'
  | 'team'
  | 'notification'
  | 'theme'
  | 'language'
  | 'home'
  | 'wallet'
  | 'investments'
  | 'chevronRight'
  | 'chevronDown';

// Mapping to actual icon components (placeholder for now)
export interface IconProps {
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
  onClick?: () => void;
  'aria-label'?: string;
}
export type ProfessionalIconComponent = ComponentType<IconProps> | null;

export const iconMap: Record<ProfessionalIconName, ProfessionalIconComponent> = {
  dashboard: null,
  accounts: null,
  transactions: null,
  budgets: null,
  goals: null,
  reports: null,
  settings: null,
  logout: null,
  analytics: null,
  calendar: null,
  chart: null,
  filter: null,
  search: null,
  add: null,
  edit: null,
  delete: null,
  save: null,
  cancel: null,
  close: null,
  check: null,
  warning: null,
  error: null,
  info: null,
  help: null,
  menu: null,
  export: null,
  import: null,
  download: null,
  upload: null,
  refresh: null,
  sync: null,
  lock: null,
  unlock: null,
  user: null,
  team: null,
  notification: null,
  theme: null,
  language: null,
  home: null,
  wallet: null,
  budget: null,
  investments: null,
  chevronRight: null,
  chevronDown: null
};
