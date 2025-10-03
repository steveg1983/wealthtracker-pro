/**
 * Button Component - Standardized button component with consistent styling and accessibility
 *
 * Features:
 * - Multiple variants (primary, secondary, danger, ghost, etc.)
 * - Different sizes (sm, md, lg, xl)
 * - Loading states with spinners
 * - Icon support
 * - Full accessibility compliance
 * - Consistent styling patterns
 */

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'outline' | 'link';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  const getVariantClasses = (): string => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white border-transparent disabled:bg-blue-300';
      case 'secondary':
        return 'bg-gray-200 hover:bg-gray-300 focus:ring-gray-500 text-gray-900 border-transparent disabled:bg-gray-100 disabled:text-gray-400 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500';
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white border-transparent disabled:bg-red-300';
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500 text-white border-transparent disabled:bg-yellow-300';
      case 'ghost':
        return 'bg-transparent hover:bg-gray-100 focus:ring-gray-500 text-gray-700 border-transparent disabled:text-gray-400 dark:text-gray-300 dark:hover:bg-gray-800';
      case 'outline':
        return 'bg-transparent hover:bg-gray-50 focus:ring-blue-500 text-blue-600 border-blue-600 disabled:text-blue-300 disabled:border-blue-200 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-gray-800';
      case 'link':
        return 'bg-transparent hover:underline focus:ring-blue-500 text-blue-600 border-transparent p-0 disabled:text-blue-300 dark:text-blue-400';
      default:
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white border-transparent disabled:bg-blue-300';
    }
  };

  const getSizeClasses = (): string => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-sm';
      case 'md':
        return 'px-4 py-2 text-sm';
      case 'lg':
        return 'px-6 py-3 text-base';
      case 'xl':
        return 'px-8 py-4 text-lg';
      default:
        return 'px-4 py-2 text-sm';
    }
  };

  const getIconSize = (): string => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4';
      case 'md':
        return 'w-4 h-4';
      case 'lg':
        return 'w-5 h-5';
      case 'xl':
        return 'w-6 h-6';
      default:
        return 'w-4 h-4';
    }
  };

  const baseClasses = [
    'inline-flex items-center justify-center',
    'font-medium rounded-md',
    'border border-transparent',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'transition-colors duration-200',
    'disabled:cursor-not-allowed disabled:opacity-50',
    variant === 'link' ? '' : 'shadow-sm hover:shadow-md',
    fullWidth ? 'w-full' : '',
    getVariantClasses(),
    variant === 'link' ? '' : getSizeClasses(),
    className
  ].filter(Boolean).join(' ');

  const iconClasses = getIconSize();

  const isDisabled = disabled || isLoading;

  const renderIcon = (icon: React.ReactNode): React.ReactNode => {
    if (!icon) return null;

    if (React.isValidElement(icon)) {
      return React.cloneElement(icon, {
        className: `${iconClasses} ${icon.props.className || ''}`.trim()
      } as any);
    }

    return <span className={iconClasses}>{icon}</span>;
  };

  const renderLoadingSpinner = (): React.ReactNode => (
    <svg
      className={`animate-spin ${iconClasses}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  const renderContent = (): React.ReactNode => {
    if (isLoading) {
      return (
        <>
          {renderLoadingSpinner()}
          {loadingText && <span className="ml-2">{loadingText}</span>}
        </>
      );
    }

    return (
      <>
        {leftIcon && (
          <span className={children ? 'mr-2' : ''}>
            {renderIcon(leftIcon)}
          </span>
        )}
        {children}
        {rightIcon && (
          <span className={children ? 'ml-2' : ''}>
            {renderIcon(rightIcon)}
          </span>
        )}
      </>
    );
  };

  return (
    <button
      className={baseClasses}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      {...props}
    >
      {renderContent()}
    </button>
  );
}

// Pre-configured button variants for common use cases
export function PrimaryButton(props: Omit<ButtonProps, 'variant'>): React.JSX.Element {
  return <Button variant="primary" {...props} />;
}

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>): React.JSX.Element {
  return <Button variant="secondary" {...props} />;
}

export function DangerButton(props: Omit<ButtonProps, 'variant'>): React.JSX.Element {
  return <Button variant="danger" {...props} />;
}

export function GhostButton(props: Omit<ButtonProps, 'variant'>): React.JSX.Element {
  return <Button variant="ghost" {...props} />;
}

export function OutlineButton(props: Omit<ButtonProps, 'variant'>): React.JSX.Element {
  return <Button variant="outline" {...props} />;
}

export function LinkButton(props: Omit<ButtonProps, 'variant'>): React.JSX.Element {
  return <Button variant="link" {...props} />;
}

// Icon button specifically for icon-only buttons
export interface IconButtonProps extends Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'children'> {
  icon: React.ReactNode;
  'aria-label': string;
}

export function IconButton({
  icon,
  'aria-label': ariaLabel,
  size = 'md',
  ...props
}: IconButtonProps): React.JSX.Element {
  const getSizeClasses = (): string => {
    switch (size) {
      case 'sm':
        return 'p-1';
      case 'md':
        return 'p-2';
      case 'lg':
        return 'p-3';
      case 'xl':
        return 'p-4';
      default:
        return 'p-2';
    }
  };

  return (
    <Button
      aria-label={ariaLabel}
      className={getSizeClasses()}
      size={size}
      {...props}
    >
      {icon}
    </Button>
  );
}

export default Button;