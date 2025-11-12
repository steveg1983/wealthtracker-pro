import { Component, useRef } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangleIcon, RefreshCwIcon, HomeIcon } from './icons';
import { captureException } from '../lib/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundaryClass extends Component<Props & { resetKey?: string }, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
    this.handlePopState = this.handlePopState.bind(this);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Report to Sentry
    captureException(error, {
      componentStack: errorInfo.componentStack,
      props: this.props,
    });
    
    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidMount() {
    // Listen for browser back/forward navigation
    window.addEventListener('popstate', this.handlePopState);
    // Also listen for hash changes
    window.addEventListener('hashchange', this.handlePopState);
    // Listen for pushstate/replacestate (programmatic navigation)
    this.interceptHistoryMethods();
  }

  componentWillUnmount() {
    // Clean up the event listeners
    window.removeEventListener('popstate', this.handlePopState);
    window.removeEventListener('hashchange', this.handlePopState);
    // Restore original history methods
    this.restoreHistoryMethods();
  }

  originalPushState?: typeof window.history.pushState;
  originalReplaceState?: typeof window.history.replaceState;

  interceptHistoryMethods = () => {
    // Store original methods
    this.originalPushState = window.history.pushState;
    this.originalReplaceState = window.history.replaceState;

    // Override pushState
    window.history.pushState = (...args) => {
      this.originalPushState?.apply(window.history, args);
      this.handlePopState();
    };

    // Override replaceState
    window.history.replaceState = (...args) => {
      this.originalReplaceState?.apply(window.history, args);
      this.handlePopState();
    };
  }

  restoreHistoryMethods = () => {
    if (this.originalPushState) {
      window.history.pushState = this.originalPushState;
    }
    if (this.originalReplaceState) {
      window.history.replaceState = this.originalReplaceState;
    }
  }

  handlePopState = () => {
    // Reset error state when user navigates with browser back/forward buttons
    if (this.state.hasError) {
      console.log('ErrorBoundary: Resetting due to navigation');
      // Use setTimeout to ensure this happens after the URL has changed
      setTimeout(() => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
      }, 0);
    }
  }

  componentDidUpdate(prevProps: Props & { resetKey?: string }) {
    // Reset error state when resetKey changes (indicating navigation)
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#d4dce8] dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangleIcon size={40} className="text-red-600 dark:text-red-400" />
              </div>
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Oops! Something went wrong
            </h3>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  Error details
                </summary>
                <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-auto max-h-48">
                  <p className="text-xs font-mono text-red-600 dark:text-red-400">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="text-xs mt-2 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                <RefreshCwIcon size={18} />
                Try Again
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <HomeIcon size={18} />
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Export the class component directly as default
// It will handle browser navigation via popstate events
export default ErrorBoundaryClass;

// Also export a Router-aware version for use inside Router context
export function RouterAwareErrorBoundary(props: Props) {
  const location = useLocation();
  const errorBoundaryRef = useRef<ErrorBoundaryClass>(null);
  
  // Use location.pathname as a reset key
  // This will cause the error boundary to reset when the route changes
  return (
    <ErrorBoundaryClass 
      ref={errorBoundaryRef}
      resetKey={location.pathname}
      {...props} 
    />
  );
}
