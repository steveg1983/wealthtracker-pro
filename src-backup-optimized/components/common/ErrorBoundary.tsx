/**
 * @component ErrorBoundary
 * @description Enterprise-grade error boundary with automatic recovery, 
 * error reporting, and graceful fallback UI. Implements React's error
 * boundary pattern with world-class reliability.
 * 
 * @example
 * ```tsx
 * <ErrorBoundary fallback={CustomErrorUI} onError={handleError}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */

import React, { Component, type ErrorInfo, type ReactNode, type ComponentType } from 'react';
import * as Sentry from '@sentry/react';
import { useLogger } from '../services/ServiceProvider';
import { AlertTriangleIcon, RefreshCwIcon, HomeIcon } from '../icons';

/**
 * Error boundary state
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  lastErrorTime: number;
}

/**
 * Error boundary props
 */
export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Custom fallback component */
  fallback?: ComponentType<ErrorFallbackProps>;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Enable error reporting to Sentry */
  reportToSentry?: boolean;
  /** Enable automatic retry */
  enableRetry?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Component name for logging */
  componentName?: string;
  /** Reset error boundary when these deps change */
  resetKeys?: Array<string | number>;
  /** Reset error boundary on route change */
  resetOnRouteChange?: boolean;
}

/**
 * Props for error fallback component
 */
export interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
  errorCount: number;
  canRetry: boolean;
}

/**
 * Default error fallback UI
 */
const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  errorCount,
  canRetry,
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <AlertTriangleIcon className="h-8 w-8 text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                Something went wrong
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                {isDevelopment
                  ? error.message
                  : 'An unexpected error occurred. Our team has been notified.'}
              </p>
              
              {isDevelopment && error.stack && (
                <details className="mb-4">
                  <summary className="cursor-pointer text-xs text-red-600 dark:text-red-400 hover:underline">
                    View stack trace
                  </summary>
                  <pre className="mt-2 text-xs bg-red-100 dark:bg-red-900/40 p-2 rounded overflow-auto max-h-40">
                    {error.stack}
                  </pre>
                </details>
              )}

              {errorCount > 1 && (
                <p className="text-xs text-red-600 dark:text-red-400 mb-4">
                  This error has occurred {errorCount} times
                </p>
              )}

              <div className="flex gap-2">
                {canRetry && (
                  <button
                    onClick={resetError}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    <RefreshCwIcon className="h-4 w-4" />
                    Try Again
                  </button>
                )}
                <button
                  onClick={() => window.location.href = '/'}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-lg transition-colors"
                >
                  <HomeIcon className="h-4 w-4" />
                  Go Home
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Enterprise-grade error boundary implementation
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryCount = 0;
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorCount: 0,
      lastErrorTime: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, reportToSentry = true, componentName = 'Unknown' } = this.props;

    // Log error details
    logger.error(`Error in ${componentName}:`, {
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: componentName,
      timestamp: new Date().toISOString(),
    });

    // Report to Sentry
    if (reportToSentry) {
      Sentry.withScope((scope) => {
        scope.setTag('error_boundary', componentName);
        scope.setContext('error_info', {
          componentStack: errorInfo.componentStack,
          errorBoundary: componentName,
        });
        Sentry.captureException(error);
      });
    }

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo);
    }

    // Update state with error info
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Attempt automatic retry if enabled
    if (this.shouldAutoRetry()) {
      this.scheduleRetry();
    }
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys, resetOnRouteChange } = this.props;
    
    // Reset on resetKeys change
    if (resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => key !== prevProps.resetKeys![index]
      );
      
      if (hasResetKeyChanged) {
        this.resetError();
      }
    }

    // Reset on route change if enabled
    if (resetOnRouteChange && window.location.pathname !== this.lastPathname) {
      this.lastPathname = window.location.pathname;
      this.resetError();
    }
  }

  override componentWillUnmount(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private lastPathname = window.location.pathname;

  private shouldAutoRetry(): boolean {
    const { enableRetry = false, maxRetries = 3 } = this.props;
    return enableRetry && this.retryCount < maxRetries;
  }

  private scheduleRetry(): void {
    const { retryDelay = 1000 } = this.props;
    
    this.retryTimeoutId = setTimeout(() => {
      this.retryCount++;
      logger.info(`Auto-retrying after error (attempt ${this.retryCount})`);
      this.resetError();
    }, retryDelay * Math.pow(2, this.retryCount)); // Exponential backoff
  }

  resetError = (): void => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  override render(): ReactNode {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { children, fallback: FallbackComponent = DefaultErrorFallback, maxRetries = 3 } = this.props;

    if (hasError && error) {
      return (
        <FallbackComponent
          error={error}
          errorInfo={errorInfo}
          resetError={this.resetError}
          errorCount={errorCount}
          canRetry={this.retryCount < maxRetries}
        />
      );
    }

    return children;
  }
}

/**
 * Hook for using error boundary programmatically
 */
export function useErrorHandler(): (error: Error) => void {
  const logger = useLogger();
  return (error: Error) => {
    logger.error('Error caught by useErrorHandler:', error);
    Sentry.captureException(error);
    throw error; // Re-throw to be caught by nearest error boundary
  };
}

/**
 * Higher-order component for adding error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `WithErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * Async error boundary for handling promise rejections
 */
export class AsyncErrorBoundary extends ErrorBoundary {
  private unhandledRejectionHandler = (event: PromiseRejectionEvent): void => {
    const error = new Error(
      event.reason?.message || event.reason?.toString() || 'Unhandled promise rejection'
    );
    
    this.componentDidCatch(error, {
      componentStack: 'Async operation',
    } as ErrorInfo);
  };

  componentDidMount(): void {
    window.addEventListener('unhandledrejection', this.unhandledRejectionHandler);
  }

  componentWillUnmount(): void {
    super.componentWillUnmount();
    window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler);
  }
}
