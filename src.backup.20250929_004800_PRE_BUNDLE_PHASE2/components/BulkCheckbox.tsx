import React from 'react';
import { CheckIcon, MinusIcon } from './icons';

interface BulkCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function BulkCheckbox({
  checked,
  indeterminate = false,
  onChange,
  disabled = false,
  size = 'md',
  className = '',
}: BulkCheckboxProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20,
  };

  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        rounded border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:ring-offset-1
        ${checked || indeterminate
          ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
          : 'border-gray-300 dark:border-gray-600 hover:border-[var(--color-primary)] bg-white dark:bg-gray-700'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      aria-checked={indeterminate ? 'mixed' : checked}
      role="checkbox"
    >
      {checked && !indeterminate && (
        <CheckIcon size={iconSizes[size]} className="text-white" />
      )}
      {indeterminate && (
        <MinusIcon size={iconSizes[size]} className="text-white" />
      )}
    </button>
  );
}