/**
 * Async Boundary Pattern for Advanced Architecture
 * Phase 4: Advanced architectural patterns implementation
 * Provides professional async state management and error boundaries
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { useLogger } from '../services/ServiceProvider';
import { z } from 'zod';
import { errorTaxonomyService, type CategorizedError } from '../services/ErrorTaxonomyService';

// Async state schema validation
const AsyncStateSchema = z.object({
  loading: z.boolean(),
  error: z.string().nullable(),
  data: z.unknown().nullable(),
  retryCount: z.number().min(0)
});

type AsyncState<T = unknown> = {
  loading: boolean;
  error: string | null;
  data: T | null;
  retryCount: number;
};

interface AsyncBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface AsyncBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  categorizedError: CategorizedError | null;
}

/**
 * Advanced Async Boundary with professional error handling and retry logic
 * Implements enterprise-grade async state management patterns
 */
export class AsyncBoundary extends Component<AsyncBoundaryProps, AsyncBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: AsyncBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
      categorizedError: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AsyncBoundaryState> {
    const categorizedError = errorTaxonomyService.processError(error);
    return {
      hasError: true,
      error,
      categorizedError
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Professional error logging with context
    logger.error('AsyncBoundary caught error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Attempt automatic retry for transient errors
    this.attemptRetry();
  }

  private attemptRetry = (): void => {
    const { maxRetries = 3, retryDelay = 1000 } = this.props;

    if (this.state.retryCount < maxRetries) {
      logger.info('Attempting async boundary retry:', {
        attempt: this.state.retryCount + 1,
        maxRetries
      });

      this.retryTimeoutId = setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: null,
          retryCount: prevState.retryCount + 1,
          categorizedError: null
        }));
      }, retryDelay * Math.pow(2, this.state.retryCount)); // Exponential backoff
    }
  };

  private handleManualRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      retryCount: 0,
      categorizedError: null
    });
  };

  componentWillUnmount(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const { fallback, maxRetries = 3 } = this.props;
      const { error, retryCount, categorizedError } = this.state;

      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default professional error UI
      return (
        <div className="async-boundary-error p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 text-red-500">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                {categorizedError?.severity === 'critical' ? 'Critical Error' : 'Something went wrong'}
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>{categorizedError?.userMessage || 'We encountered an unexpected error. The issue has been logged and our team will investigate.'}</p>
                {categorizedError?.recoveryAction && (
                  <p className="mt-2 font-medium">
                    💡 {categorizedError.recoveryAction}
                  </p>
                )}
                {retryCount < maxRetries && (
                  <p className="mt-2">
                    Retry attempt {retryCount + 1} of {maxRetries} will happen automatically.
                  </p>
                )}
              </div>
              <div className="mt-4">
                <button
                  onClick={this.handleManualRetry}
                  className="bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-800 dark:text-red-200 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
              {process.env.NODE_ENV === 'development' && error && (
                <details className="mt-4">
                  <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer">
                    Developer Details
                  </summary>
                  <pre className="mt-2 text-xs text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/40 p-2 rounded overflow-auto">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for managing async operations with professional error handling
 */
export function useAsyncOperation<T>() {
  const logger = useLogger();
  const [state, setState] = React.useState<AsyncState<T>>({
    loading: false,
    error: null,
    data: null,
    retryCount: 0
  });

  const execute = React.useCallback(async (
    operation: () => Promise<T>,
    options: { maxRetries?: number; retryDelay?: number } = {}
  ): Promise<void> => {
    const { maxRetries = 3, retryDelay = 1000 } = options;

    setState(prev => ({ ...prev, loading: true, error: null }));

    const attemptOperation = async (attempt: number): Promise<void> => {
      try {
        const result = await operation();
        setState({
          loading: false,
          error: null,
          data: result,
          retryCount: attempt
        });
      } catch (error) {
        logger.error('Async operation failed:', {
          error,
          attempt,
          maxRetries
        });

        if (attempt < maxRetries) {
          // Exponential backoff retry
          setTimeout(() => {
            attemptOperation(attempt + 1);
          }, retryDelay * Math.pow(2, attempt));
        } else {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : 'Operation failed',
            data: null,
            retryCount: attempt
          });
        }
      }
    };

    await attemptOperation(0);
  }, []);

  const reset = React.useCallback(() => {
    setState({
      loading: false,
      error: null,
      data: null,
      retryCount: 0
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
    isSuccess: !state.loading && !state.error && state.data !== null,
    isError: !state.loading && state.error !== null
  };
}

/**
 * Higher-order component for adding async boundary protection
 */
export function withAsyncBoundary<P extends object>(
  Component: React.ComponentType<P>,
  boundaryProps: Partial<AsyncBoundaryProps> = {}
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <AsyncBoundary {...boundaryProps}>
      <Component {...props} />
    </AsyncBoundary>
  );

  WrappedComponent.displayName = `withAsyncBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

export default AsyncBoundary;
