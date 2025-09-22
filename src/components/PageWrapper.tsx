/**
 * PageWrapper Component - Common wrapper for all pages
 *
 * Features:
 * - Consistent page layout
 * - Loading states
 * - Error boundaries
 * - Page transitions
 */

import React, { ReactNode } from 'react';

interface PageWrapperProps {
  children: ReactNode;
  title?: string;
  className?: string;
  isLoading?: boolean;
  error?: string | null;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export default function PageWrapper({
  children,
  title,
  className = '',
  isLoading = false,
  error = null,
  maxWidth = 'full'
}: PageWrapperProps): React.JSX.Element {
  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    '2xl': 'max-w-7xl',
    full: 'max-w-full'
  }[maxWidth];

  // Log page render for debugging
  React.useEffect(() => {
    if (title) {
      document.title = `${title} - WealthTracker`;
    }
  }, [title]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl text-red-500 mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Something went wrong
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-6 ${maxWidthClass}`}>
        {title && (
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {title}
            </h1>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}