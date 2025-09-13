import React, { useEffect } from 'react';
import { logger } from '../../services/loggingService';

/**
 * Common icon utilities and types
 * Extracted from index.tsx for reusability
 * Updated to fix module export issue
 */

// IconProps interface - defined here for consistency with IconBase
export interface IconProps {
  size?: number;
  color?: string;
  hoverColor?: string;
  onClick?: () => void;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
  'data-testid'?: string;
}

// Re-export IconBase for compatibility
export { IconBase } from './IconBase';

/**
 * Professional icon wrapper for consistent styling
 * Creates a standardized icon component from Tabler icons
 */
export const createIconComponent = (TablerIcon: React.ComponentType<any>, displayName: string) => {
  const IconComponent: React.FC<IconProps> = ({
    size = 20,
    color = 'currentColor',
    className = '',
    onClick,
    title,
    style,
    strokeWidth = 2,
    'data-testid': dataTestId,
  }) => {
    return (
      <TablerIcon
        size={size}
        color={color}
        stroke={strokeWidth}
        className={`transition-colors duration-200 ${onClick ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
        onClick={onClick}
        style={style}
        aria-label={title}
        data-testid={dataTestId}
      />
    );
  };
  IconComponent.displayName = displayName;
  return IconComponent;
};

/**
 * Icon button component for backward compatibility
 */
export const IconButton: React.FC<{
  icon: React.ComponentType<IconProps>;
  onClick?: () => void;
  className?: string;
  title?: string;
  size?: number;
}> = ({ icon: Icon, onClick, className = '', title, size = 20 }) => {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
      title={title}
      aria-label={title}
    >
      <Icon size={size} />
    </button>
  );
};

