import React from 'react';
import { RefreshCwIcon } from '../icons';

interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function LoadingState({ 
  message = 'Loading...', 
  size = 'medium',
  className = '' 
}: LoadingStateProps): React.JSX.Element {
  const sizeClasses = {
    small: 'h-32',
    medium: 'h-48',
    large: 'h-64'
  };

  const iconSizes = {
    small: 24,
    medium: 32,
    large: 48
  };

  return (
    <div className={`flex flex-col items-center justify-center ${sizeClasses[size]} ${className}`}>
      <RefreshCwIcon 
        size={iconSizes[size]} 
        className="text-primary animate-spin mb-4"
      />
      <p className="text-gray-600 dark:text-gray-400 text-sm">{message}</p>
    </div>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  fullScreen?: boolean;
}

export function LoadingOverlay({ 
  isLoading, 
  message = 'Loading...', 
  fullScreen = false 
}: LoadingOverlayProps): React.JSX.Element | null {
  if (!isLoading) return null;

  const positionClass = fullScreen ? 'fixed' : 'absolute';

  return (
    <div className={`${positionClass} inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center`}>
      <div className="bg-card-bg-light dark:bg-card-bg-dark rounded-lg shadow-xl p-6 flex flex-col items-center">
        <RefreshCwIcon 
          size={32} 
          className="text-primary animate-spin mb-4"
        />
        <p className="text-gray-700 dark:text-gray-300">{message}</p>
      </div>
    </div>
  );
}

interface LoadingDotsProps {
  className?: string;
}

export function LoadingDots({ className = '' }: LoadingDotsProps): React.JSX.Element {
  return (
    <span className={`inline-flex space-x-1 ${className}`}>
      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
    </span>
  );
}

interface LoadingButtonProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export function LoadingButton({ 
  isLoading, 
  children, 
  loadingText = 'Loading...', 
  className = '',
  disabled = false,
  onClick
}: LoadingButtonProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={isLoading || disabled}
      className={`relative ${className} ${isLoading ? 'cursor-not-allowed' : ''}`}
    >
      <span className={`${isLoading ? 'invisible' : ''}`}>{children}</span>
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <RefreshCwIcon size={16} className="animate-spin mr-2" />
          {loadingText}
        </span>
      )}
    </button>
  );
}