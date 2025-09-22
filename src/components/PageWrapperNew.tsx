/**
 * PageWrapperNew Component - Enhanced page wrapper with modern features
 *
 * Features:
 * - Enhanced loading states
 * - Better error handling
 * - Improved accessibility
 * - Advanced page transitions
 */

import React, { ReactNode, useEffect } from 'react';

interface PageWrapperNewProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  isLoading?: boolean;
  error?: string | null;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  showBackButton?: boolean;
  onBack?: () => void;
  headerActions?: ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
}

export default function PageWrapperNew({
  children,
  title,
  subtitle,
  className = '',
  isLoading = false,
  error = null,
  maxWidth = 'full',
  showBackButton = false,
  onBack,
  headerActions,
  breadcrumb
}: PageWrapperNewProps): React.JSX.Element {
  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    '2xl': 'max-w-7xl',
    '3xl': 'max-w-8xl',
    full: 'max-w-full'
  }[maxWidth];

  // Log page render and update document title
  useEffect(() => {
    if (title) {
      document.title = `${title} - WealthTracker`;
    }
  }, [title]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-6">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            Oops! Something went wrong
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Reload Page
            </button>
            <button
              onClick={() => window.history.back()}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <div className="absolute inset-0 w-12 h-12 border-4 border-blue-200 dark:border-blue-800 rounded-full mx-auto opacity-25"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {title ? `Loading ${title}...` : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-6 ${maxWidthClass}`}>
        {/* Breadcrumb */}
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="mb-6" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm">
              {breadcrumb.map((item, index) => (
                <li key={index} className="flex items-center">
                  {index > 0 && (
                    <svg
                      className="w-4 h-4 mx-2 text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {item.href ? (
                    <a
                      href={item.href}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors duration-200"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">
                      {item.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Header */}
        {(title || showBackButton || headerActions) && (
          <header className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {showBackButton && (
                  <button
                    onClick={onBack || (() => window.history.back())}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors duration-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                    aria-label="Go back"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                )}

                <div>
                  {title && (
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              {headerActions && (
                <div className="flex items-center space-x-3">
                  {headerActions}
                </div>
              )}
            </div>
          </header>
        )}

        {/* Content */}
        <main className="animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  );
}