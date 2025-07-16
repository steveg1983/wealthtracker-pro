import React from 'react';

interface IconButtonProps {
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  icon: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  rounded?: boolean;
  className?: string;
  title?: string;
  disabled?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12'
};

const variantClasses = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-gray-500 hover:bg-gray-600 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
};

export const IconButton: React.FC<IconButtonProps> = ({
  onClick,
  icon,
  size = 'md',
  variant = 'ghost',
  rounded = true,
  className = '',
  title,
  disabled = false
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${rounded ? 'rounded-lg' : ''}
        flex items-center justify-center
        transition-all duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      title={title}
      type="button"
    >
      {icon}
    </button>
  );
};