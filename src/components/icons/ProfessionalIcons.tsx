/**
 * Professional Icon System for WealthTracker
 * Using Tabler Icons for enterprise-grade appearance
 */

import React from 'react';
import { logger } from '../../services/loggingService';
import { ICON_CONFIG, iconMap, type ProfessionalIconName } from '../../constants/professionalIcons';

export type { ProfessionalIconName };

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
    logger.warn(`Icon "${name}" not found in professional icon set`);
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
