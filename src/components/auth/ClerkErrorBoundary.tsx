import React, { Component, ErrorInfo, ReactNode } from 'react';
import { 
  AlertTriangleIcon as AlertTriangle,
  RefreshCwIcon as RefreshCw,
  HomeIcon as Home,
  ChromeIcon as Chrome
} from '../icons';
import { handleClerkSafariError } from '../../utils/clerkSafarifix';
import { isSafari } from '../../utils/safariCompat';
import { logger } from '../../services/loggingService';

declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error, context?: any) => void;
    };
  }
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isSafariIssue: boolean;
  safariSolution: { message: string; solution: string } | null;
}

export class ClerkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isSafariIssue: false,
      safariSolution: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a Safari-specific issue
    const isSafariIssue = isSafari() && (
      error.message.includes('localStorage') ||
      error.message.includes('sessionStorage') ||
      error.message.includes('cookie') ||
      error.message.includes('Clerk') ||
      error.message.includes('authentication')
    );

    const safariSolution = isSafariIssue ? handleClerkSafariError(error) : null;

    return {
      hasError: true,
      error,
      errorInfo: null,
      isSafariIssue,
      safariSolution
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Clerk authentication error:', error, errorInfo.componentStack || '');
    
    // Log to error tracking service if available
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          },
          browser: {
            safari: isSafari(),
            userAgent: navigator.userAgent
          }
        }
      });
    }

    this.setState({
      errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleClearStorage = () => {
    try {
      // Clear all Clerk-related storage
      const keysToRemove: string[] = [];
      
      // Find all Clerk keys in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('clerk') || key.includes('__session'))) {
          keysToRemove.push(key);
        }
      }
      
      // Remove them
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Clear cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      // Reload
      window.location.reload();
    } catch (error) {
      logger.error('Failed to clear storage:', error);
      alert('Failed to clear storage. Please try manually clearing your browser data.');
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-blue-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-4 ${
              this.state.isSafariIssue 
                ? 'bg-gradient-to-r from-orange-500 to-red-500' 
                : 'bg-gradient-to-r from-red-500 to-pink-500'
            }`}>
              <div className="flex items-center gap-3 text-white">
                <AlertTriangle size={24} />
                <h1 className="text-xl font-bold">
                  {this.state.isSafariIssue ? 'Safari Authentication Issue' : 'Authentication Error'}
                </h1>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {this.state.isSafariIssue && this.state.safariSolution ? (
                <>
                  {/* Safari-specific error */}
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                    <p className="text-sm font-medium text-orange-900 dark:text-orange-300 mb-2">
                      {this.state.safariSolution.message}
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-400">
                      {this.state.safariSolution.solution}
                    </p>
                  </div>

                  {/* Alternative browsers */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      For the best experience, try using:
                    </p>
                    <div className="flex gap-2">
                      <a
                        href="https://www.google.com/chrome/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-gray-900/30 text-blue-700 dark:text-gray-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors text-sm"
                      >
                        <Chrome size={16} />
                        Chrome
                      </a>
                      <a
                        href="https://www.microsoft.com/edge"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors text-sm"
                      >
                        Edge
                      </a>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Generic error */}
                  <p className="text-gray-700 dark:text-gray-300">
                    We encountered an error with the authentication system. This might be temporary.
                  </p>
                  
                  {this.state.error && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                        Technical details
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-auto">
                        {this.state.error.message}
                      </pre>
                    </details>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={this.handleReload}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw size={18} />
                  Try Again
                </button>
                
                <button
                  onClick={this.handleClearStorage}
                  className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  Clear Storage & Retry
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Home size={16} />
                  Go to Homepage
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
