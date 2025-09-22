/**
 * Card Component - Reusable card component with consistent styling
 *
 * Features:
 * - Multiple variants (default, outlined, elevated)
 * - Padding options
 * - Header and footer sections
 * - Hover states
 * - Dark mode support
 */

import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  hoverable?: boolean;
  onClick?: () => void;
}

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  header,
  footer,
  hoverable = false,
  onClick
}: CardProps): React.JSX.Element {
  const getVariantClasses = (): string => {
    switch (variant) {
      case 'outlined':
        return 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700';
      case 'elevated':
        return 'bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700';
      case 'flat':
        return 'bg-gray-50 dark:bg-gray-800';
      case 'default':
      default:
        return 'bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700';
    }
  };

  const getPaddingClasses = (): string => {
    switch (padding) {
      case 'none':
        return '';
      case 'sm':
        return 'p-3';
      case 'lg':
        return 'p-8';
      case 'xl':
        return 'p-12';
      case 'md':
      default:
        return 'p-6';
    }
  };

  const getHoverClasses = (): string => {
    if (hoverable || onClick) {
      return 'transition-all duration-200 hover:shadow-md hover:scale-[1.02] cursor-pointer';
    }
    return '';
  };

  const cardClasses = [
    'rounded-lg',
    getVariantClasses(),
    getPaddingClasses(),
    getHoverClasses(),
    className
  ].filter(Boolean).join(' ');

  const handleClick = (): void => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {header && (
        <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          {header}
        </div>
      )}

      <div className="flex-1">
        {children}
      </div>

      {footer && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {footer}
        </div>
      )}
    </div>
  );
}

// Specialized card variants for common use cases
export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  className = ''
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <Card variant="default" className={className}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={`flex items-center mt-2 text-sm ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              <span className="mr-1">
                {trend.isPositive ? '↑' : '↓'}
              </span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="ml-4 text-gray-400 dark:text-gray-500">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function LoadingCard({
  className = ''
}: {
  className?: string;
}): React.JSX.Element {
  return (
    <Card className={className}>
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
      </div>
    </Card>
  );
}

export function ErrorCard({
  title = 'Something went wrong',
  message,
  onRetry,
  className = ''
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}): React.JSX.Element {
  return (
    <Card variant="outlined" className={className}>
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        {message && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {message}
          </p>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Try Again
          </button>
        )}
      </div>
    </Card>
  );
}

export function EmptyCard({
  title = 'No data available',
  message,
  action,
  className = ''
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <Card variant="flat" className={className}>
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        {message && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {message}
          </p>
        )}
        {action}
      </div>
    </Card>
  );
}

export default Card;