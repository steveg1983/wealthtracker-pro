/**
 * Accessible Button Component
 * Ensures proper keyboard navigation and screen reader support
 */

import React, { forwardRef } from 'react';
import { LoadingIcon } from '../icons';

interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      disabled,
      ariaLabel,
      ariaDescribedBy,
      ariaPressed,
      ariaExpanded,
      ariaControls,
      onClick,
      ...props
    },
    ref
  ) => {
    // Variant styles
    const variantStyles = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 focus:ring-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
      ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-500',
      link: 'bg-transparent text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline focus:ring-blue-500'
    };

    // Size styles
    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg'
    };

    // Disabled styles
    const disabledStyles = disabled || isLoading
      ? 'opacity-50 cursor-not-allowed'
      : 'cursor-pointer';

    // Focus styles
    const focusStyles = 'focus:outline-none focus:ring-2 focus:ring-offset-2';

    // Handle keyboard activation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      // Space or Enter should activate button
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!disabled && !isLoading) {
          // Trigger native click to generate proper MouseEvent for onClick handler
          e.currentTarget.click();
        }
      }
    };

    const buttonContent = (
      <>
        {isLoading && (
          <LoadingIcon className="animate-spin h-4 w-4" />
        )}
        {!isLoading && leftIcon && (
          <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span className="inline-flex items-center">
          {isLoading && loadingText ? loadingText : children}
        </span>
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0">{rightIcon}</span>
        )}
      </>
    );

    return (
      <button
        ref={ref}
        type="button"
        className={`
          inline-flex items-center justify-center gap-2 font-medium rounded-lg
          transition-colors duration-200
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${disabledStyles}
          ${focusStyles}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        disabled={disabled || isLoading}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-pressed={ariaPressed}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        aria-busy={isLoading}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {buttonContent}
      </button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';

// Icon button variant for better accessibility
interface IconButtonProps extends Omit<AccessibleButtonProps, 'children'> {
  icon: React.ReactNode;
  label: string; // Required for screen readers
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, size = 'md', className = '', ...props }, ref) => {
    const sizeClasses = {
      sm: 'p-1.5',
      md: 'p-2',
      lg: 'p-3'
    };

    return (
      <AccessibleButton
        ref={ref}
        variant="ghost"
        className={`${sizeClasses[size]} ${className}`}
        ariaLabel={label}
        {...props}
      >
        <span className="sr-only">{label}</span>
        {icon}
      </AccessibleButton>
    );
  }
);

IconButton.displayName = 'IconButton';

// Button group for related actions
interface ButtonGroupProps {
  children: React.ReactNode;
  ariaLabel?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({ children, ariaLabel }) => {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg shadow-sm"
    >
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          const isFirst = index === 0;
          const isLast = index === React.Children.count(children) - 1;

          return React.cloneElement(child as React.ReactElement<{ className?: string }>, {
            className: `
              ${(child.props as { className?: string }).className || ''}
              ${!isFirst ? '-ml-px' : ''}
              ${isFirst ? 'rounded-r-none' : ''}
              ${isLast ? 'rounded-l-none' : ''}
              ${!isFirst && !isLast ? 'rounded-none' : ''}
            `.trim()
          });
        }
        return child;
      })}
    </div>
  );
};
