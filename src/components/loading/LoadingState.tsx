/**
 * LoadingState Component - Centralized loading states and spinners
 *
 * Features:
 * - Multiple loading variants
 * - Skeleton loading patterns
 * - Progress indicators
 * - Accessible loading states
 * - Customizable styling
 */

import React from 'react';

interface LoadingStateProps {
  variant?: 'spinner' | 'dots' | 'skeleton' | 'progress' | 'pulse';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  progress?: number; // 0-100 for progress variant
  className?: string;
  fullScreen?: boolean;
  color?: 'blue' | 'gray' | 'green' | 'red' | 'yellow';
}

export function LoadingState({
  variant = 'spinner',
  size = 'md',
  message,
  progress,
  className = '',
  fullScreen = false,
  color = 'blue'
}: LoadingStateProps): React.JSX.Element {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4';
      case 'md':
        return 'w-8 h-8';
      case 'lg':
        return 'w-12 h-12';
      case 'xl':
        return 'w-16 h-16';
      default:
        return 'w-8 h-8';
    }
  };

  const getColorClasses = () => {
    switch (color) {
      case 'blue':
        return 'text-blue-600 border-blue-600';
      case 'gray':
        return 'text-gray-600 border-gray-600';
      case 'green':
        return 'text-green-600 border-green-600';
      case 'red':
        return 'text-red-600 border-red-600';
      case 'yellow':
        return 'text-yellow-600 border-yellow-600';
      default:
        return 'text-blue-600 border-blue-600';
    }
  };

  const renderLoadingElement = () => {
    const sizeClasses = getSizeClasses();
    const colorClasses = getColorClasses();

    switch (variant) {
      case 'spinner':
        return (
          <div
            className={`${sizeClasses} ${colorClasses} animate-spin rounded-full border-2 border-t-transparent`}
            role="status"
            aria-label="Loading"
          />
        );

      case 'dots':
        return (
          <div className="flex space-x-1" role="status" aria-label="Loading">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 ${color === 'blue' ? 'bg-blue-600' : `bg-${color}-600`} rounded-full animate-bounce`}
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        );

      case 'skeleton':
        return <SkeletonLoader size={size} />;

      case 'progress':
        return (
          <div className="w-full">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 ${color === 'blue' ? 'bg-blue-600' : `bg-${color}-600`} rounded-full transition-all duration-300`}
                style={{ width: `${progress || 0}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            {progress !== undefined && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 text-center">
                {Math.round(progress)}%
              </p>
            )}
          </div>
        );

      case 'pulse':
        return (
          <div className={`${sizeClasses} ${color === 'blue' ? 'bg-blue-600' : `bg-${color}-600`} rounded-full animate-pulse`} />
        );

      default:
        return (
          <div
            className={`${sizeClasses} ${colorClasses} animate-spin rounded-full border-2 border-t-transparent`}
            role="status"
            aria-label="Loading"
          />
        );
    }
  };

  const content = (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className}`}>
      {renderLoadingElement()}
      {message && (
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-xs">
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75">
        {content}
      </div>
    );
  }

  return content;
}

// Skeleton loader component
interface SkeletonLoaderProps {
  size: 'sm' | 'md' | 'lg' | 'xl';
}

function SkeletonLoader({ size }: SkeletonLoaderProps): React.JSX.Element {
  const getSkeletonClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-4';
      case 'md':
        return 'h-6';
      case 'lg':
        return 'h-8';
      case 'xl':
        return 'h-12';
      default:
        return 'h-6';
    }
  };

  const skeletonClasses = getSkeletonClasses();

  return (
    <div className="animate-pulse space-y-3" role="status" aria-label="Loading content">
      <div className={`bg-gray-200 dark:bg-gray-700 rounded ${skeletonClasses} w-3/4`} />
      <div className={`bg-gray-200 dark:bg-gray-700 rounded ${skeletonClasses} w-1/2`} />
      <div className={`bg-gray-200 dark:bg-gray-700 rounded ${skeletonClasses} w-2/3`} />
    </div>
  );
}

// Specialized loading components
export function TableLoadingState(): React.JSX.Element {
  return (
    <div className="animate-pulse">
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex space-x-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/5" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardLoadingState(): React.JSX.Element {
  return (
    <div className="animate-pulse">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          <div className="flex space-x-4 mt-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChartLoadingState(): React.JSX.Element {
  return (
    <div className="animate-pulse">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="flex justify-center space-x-4 mt-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-18" />
        </div>
      </div>
    </div>
  );
}

export function FormLoadingState(): React.JSX.Element {
  return (
    <div className="animate-pulse space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        </div>
      ))}
      <div className="flex space-x-3">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-20" />
      </div>
    </div>
  );
}

export function ListLoadingState({ itemCount = 5 }: { itemCount?: number }): React.JSX.Element {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: itemCount }, (_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        </div>
      ))}
    </div>
  );
}

// Hook for managing loading states
export function useLoadingState(initialState = false) {
  const [isLoading, setIsLoading] = React.useState(initialState);

  const startLoading = () => setIsLoading(true);
  const stopLoading = () => setIsLoading(false);
  const toggleLoading = () => setIsLoading(prev => !prev);

  return {
    isLoading,
    startLoading,
    stopLoading,
    toggleLoading,
    setIsLoading
  };
}

// Loading Button Component
interface LoadingButtonProps {
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingButton({
  loading = false,
  disabled = false,
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  className = ''
}: LoadingButtonProps): React.JSX.Element {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 focus:ring-blue-500'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
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
      )}
      {children}
    </button>
  );
}

// Default export
export default LoadingState;