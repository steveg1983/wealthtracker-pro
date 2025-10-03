import React from 'react';
import { LoadingIcon } from '../icons';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ElementType;
  rightIcon?: React.ElementType;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps): React.JSX.Element {
  const baseStyles = `
    inline-flex items-center justify-center font-medium
    transition-all duration-[var(--duration-fast)] ease-[var(--easing-inOut)]
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;
  
  const variantStyles = {
    primary: `
      bg-[var(--color-interactive-primary)] text-white
      hover:bg-[var(--color-interactive-primaryHover)]
      active:bg-[var(--color-interactive-primaryActive)]
      focus:ring-[var(--color-interactive-primary)]
    `,
    secondary: `
      bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]
      border border-[var(--color-border-primary)]
      hover:bg-[var(--color-surface-tertiary)]
      focus:ring-[var(--color-border-focus)]
    `,
    danger: `
      bg-[var(--color-status-error)] text-white
      hover:opacity-90
      focus:ring-[var(--color-status-error)]
    `,
    success: `
      bg-[var(--color-status-success)] text-white
      hover:opacity-90
      focus:ring-[var(--color-status-success)]
    `,
    ghost: `
      bg-transparent text-[var(--color-text-primary)]
      hover:bg-[var(--color-surface-secondary)]
      focus:ring-[var(--color-border-focus)]
    `,
  };
  
  const sizeStyles = {
    sm: 'px-[var(--spacing-3)] py-[var(--spacing-1-5)] text-[var(--font-size-sm)] rounded-[var(--radius-md)]',
    md: 'px-[var(--spacing-4)] py-[var(--spacing-2)] text-[var(--font-size-base)] rounded-[var(--radius-md)]',
    lg: 'px-[var(--spacing-6)] py-[var(--spacing-3)] text-[var(--font-size-lg)] rounded-[var(--radius-lg)]',
  };
  
  const widthStyles = fullWidth ? 'w-full' : '';
  
  const iconSize = {
    sm: 14,
    md: 16,
    lg: 20,
  }[size];
  
  return (
    <button
      className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${widthStyles}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <LoadingIcon className="animate-spin mr-2" size={iconSize} />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {LeftIcon && <LeftIcon className="mr-2" size={iconSize} />}
          {children}
          {RightIcon && <RightIcon className="ml-2" size={iconSize} />}
        </>
      )}
    </button>
  );
}