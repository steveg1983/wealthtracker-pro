/**
 * Professional Icon System for WealthTracker
 * Using Tabler Icons for enterprise-grade appearance
 */

import React from 'react';
import {
  // Navigation & Core
  IconHome,
  IconSettings,
  IconWallet,
  IconArrowsExchange,
  IconChartBar,
  IconTarget,
  IconTrendingUp,
  IconChartPie,
  IconFileText,
  IconBuildingBank,
  
  // Settings & Management
  IconDatabase,
  IconTags,
  IconCategory,
  IconAdjustments,
  
  // Actions
  IconPlus,
  IconPencil,
  IconTrash,
  IconX,
  IconCheck,
  IconDownload,
  IconUpload,
  IconRefresh,
  IconSearch,
  IconFilter,
  IconSortDescending,
  
  // UI Elements
  IconChevronRight,
  IconChevronDown,
  IconChevronLeft,
  IconChevronUp,
  IconMenu2,
  IconEye,
  IconEyeOff,
  IconCopy,
  IconExternalLink,
  IconGripVertical,
  
  // Status & Feedback
  IconAlertCircle,
  IconAlertTriangle,
  IconInfoCircle,
  IconCircleCheck,
  IconCircleX,
  IconBell,
  IconBellOff,
  
  // Financial
  IconCreditCard,
  IconCash,
  IconReceipt,
  IconPigMoney,
  IconCoins,
  IconCurrencyDollar,
  IconBusinessplan,
  IconReportMoney,
  IconMoneybag,
  
  // Data & Analytics
  IconChartLine,
  IconChartArea,
  IconChartDonut,
  IconReportAnalytics,
  IconPresentation,
  
  // Time & Calendar
  IconCalendar,
  IconClock,
  IconCalendarEvent,
  IconHistory,
  
  // User & Account
  IconUser,
  IconUsers,
  IconUserCircle,
  IconLogin,
  IconLogout,
  IconLock,
  IconLockOpen,
  IconShield,
  IconKey,
  
  // Misc Professional
  IconBriefcase,
  IconBuilding,
  IconFileInvoice,
  IconFolder,
  IconArchive,
  IconDeviceDesktop,
  IconMoon,
  IconSun,
  IconWorld,
  IconLink,
  IconMail,
  IconPhone,
  IconMapPin,
  IconCar,
  IconSchool,
  IconStar,
  IconAward,
  IconTrophy,
  IconCertificate,
} from '@tabler/icons-react';

// Professional icon configuration
const ICON_CONFIG = {
  size: 20,
  stroke: 2,
  className: 'transition-colors duration-200',
};

// Type for all available icon names
export type ProfessionalIconName = keyof typeof iconMap;

// Icon mapping for easy access
export const iconMap = {
  // Core Navigation
  home: IconHome,
  dashboard: IconChartBar,
  transactions: IconArrowsExchange,
  accounts: IconBuildingBank,
  budget: IconChartPie,
  goals: IconTarget,
  investments: IconTrendingUp,
  analytics: IconChartLine,
  reports: IconFileText,
  
  // Settings
  settings: IconSettings,
  settingsAlt: IconAdjustments,
  database: IconDatabase,
  tags: IconTags,
  categories: IconCategory,
  
  // Actions
  add: IconPlus,
  edit: IconPencil,
  delete: IconTrash,
  close: IconX,
  check: IconCheck,
  download: IconDownload,
  upload: IconUpload,
  refresh: IconRefresh,
  search: IconSearch,
  filter: IconFilter,
  sort: IconSortDescending,
  
  // UI Navigation
  chevronRight: IconChevronRight,
  chevronDown: IconChevronDown,
  chevronLeft: IconChevronLeft,
  chevronUp: IconChevronUp,
  menu: IconMenu2,
  eye: IconEye,
  eyeOff: IconEyeOff,
  copy: IconCopy,
  externalLink: IconExternalLink,
  grip: IconGripVertical,
  
  // Status
  info: IconInfoCircle,
  warning: IconAlertTriangle,
  error: IconAlertCircle,
  success: IconCircleCheck,
  close2: IconCircleX,
  notification: IconBell,
  notificationOff: IconBellOff,
  
  // Financial
  creditCard: IconCreditCard,
  cash: IconCash,
  receipt: IconReceipt,
  piggyBank: IconPigMoney,
  coins: IconCoins,
  dollar: IconCurrencyDollar,
  businessPlan: IconBusinessplan,
  moneyReport: IconReportMoney,
  wallet: IconWallet,
  moneyBag: IconMoneybag,
  
  // Analytics
  chartLine: IconChartLine,
  chartArea: IconChartArea,
  chartDonut: IconChartDonut,
  chartBar: IconChartBar,
  chartPie: IconChartPie,
  analyticsReport: IconReportAnalytics,
  presentation: IconPresentation,
  
  // Time
  calendar: IconCalendar,
  clock: IconClock,
  event: IconCalendarEvent,
  history: IconHistory,
  
  // User
  user: IconUser,
  users: IconUsers,
  userCircle: IconUserCircle,
  login: IconLogin,
  logout: IconLogout,
  lock: IconLock,
  unlock: IconLockOpen,
  shield: IconShield,
  key: IconKey,
  
  // Professional
  briefcase: IconBriefcase,
  building: IconBuilding,
  bank: IconBuildingBank,
  invoice: IconFileInvoice,
  folder: IconFolder,
  archive: IconArchive,
  desktop: IconDeviceDesktop,
  moon: IconMoon,
  sun: IconSun,
  globe: IconWorld,
  link: IconLink,
  mail: IconMail,
  phone: IconPhone,
  location: IconMapPin,
  car: IconCar,
  education: IconSchool,
  star: IconStar,
  award: IconAward,
  trophy: IconTrophy,
  certificate: IconCertificate,
};

// Props interface
export interface ProfessionalIconProps {
  name: ProfessionalIconName;
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
  onClick?: () => void;
  title?: string;
}

// Main Professional Icon Component
export const ProfessionalIcon: React.FC<ProfessionalIconProps> = ({
  name,
  size = ICON_CONFIG.size,
  stroke = ICON_CONFIG.stroke,
  color = 'currentColor',
  className = '',
  onClick,
  title,
}) => {
  const IconComponent = iconMap[name];
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in professional icon set`);
    return null;
  }
  
  return (
    <IconComponent
      size={size}
      stroke={stroke}
      color={color}
      className={`${ICON_CONFIG.className} ${className} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onClick}
      aria-label={title}
    />
  );
};

// Export individual icon components for backward compatibility
export const HomeIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="home" {...props} />;

export const SettingsIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="settings" {...props} />;

export const WalletIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="wallet" {...props} />;

export const TransactionsIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="transactions" {...props} />;

export const AccountsIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="accounts" {...props} />;

export const BudgetIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="budget" {...props} />;

export const GoalsIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="goals" {...props} />;

export const InvestmentsIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="investments" {...props} />;

export const AnalyticsIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="analytics" {...props} />;

export const ReportsIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="reports" {...props} />;

// Export commonly used action icons
export const PlusIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="add" {...props} />;

export const EditIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="edit" {...props} />;

export const DeleteIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="delete" {...props} />;

export const CloseIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="close" {...props} />;

export const CheckIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="check" {...props} />;

// Export UI navigation icons
export const ChevronRightIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="chevronRight" {...props} />;

export const ChevronDownIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="chevronDown" {...props} />;

export const MenuIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="menu" {...props} />;

export const SearchIcon = (props: Omit<ProfessionalIconProps, 'name'>) => 
  <ProfessionalIcon name="search" {...props} />;

// Export all Tabler icons for direct use if needed
export * from '@tabler/icons-react';